import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useLocalStorage from '@/hooks/useLocalStorage';

/**
 * Comprehensive test suite for the useLocalStorage custom hook.
 *
 * Tests cover:
 * - localStorage read and write operations
 * - JSON serialization/deserialization
 * - Multi-tab synchronization with storage events
 * - Error handling (quota exceeded, invalid JSON, disabled localStorage)
 * - Remove value functionality
 * - SSR scenario handling
 * - TypeScript type safety with generics
 * - Edge cases and error recovery
 */
describe('useLocalStorage', () => {
  /**
   * Mock localStorage implementation for testing.
   * Uses a Map to simulate browser localStorage behavior.
   */
  let mockStorage: Map<string, string>;
  let mockLocalStorage: Storage;

  /**
   * Set up mock localStorage before each test.
   * Creates a fresh storage Map and mocks all localStorage methods.
   */
  beforeEach(() => {
    // Create fresh storage for each test
    mockStorage = new Map<string, string>();

    // Create mock localStorage object
    mockLocalStorage = {
      getItem: vi.fn((key: string) => mockStorage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        mockStorage.delete(key);
      }),
      clear: vi.fn(() => {
        mockStorage.clear();
      }),
      get length() {
        return mockStorage.size;
      },
      key: vi.fn((index: number) => {
        const keys = Array.from(mockStorage.keys());
        return keys[index] || null;
      }),
    } as Storage;

    // Replace window.localStorage with mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  /**
   * Clean up after each test to prevent state leakage.
   */
  afterEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  /**
   * Test: Initial value should be returned when localStorage is empty
   */
  it('should return initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

    // Verify initial value is returned
    expect(result.current[0]).toBe('initial-value');

    // Verify localStorage.getItem was called
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
  });

  /**
   * Test: Should return stored value from localStorage on mount
   */
  it('should return stored value from localStorage on mount', () => {
    // Pre-populate localStorage with a value
    const storedValue = { id: 1, name: 'John' };
    mockStorage.set('test-key', JSON.stringify(storedValue));

    const { result } = renderHook(() => useLocalStorage('test-key', { id: 0, name: '' }));

    // Verify stored value is returned (parsed from JSON)
    expect(result.current[0]).toEqual(storedValue);
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
  });

  /**
   * Test: Should update state and localStorage when setValue is called
   */
  it('should update state and localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Update value using setValue
    act(() => {
      result.current[1]('updated-value');
    });

    // Verify state updated
    expect(result.current[0]).toBe('updated-value');

    // Verify localStorage.setItem was called with JSON stringified value
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('updated-value'));
  });

  /**
   * Test: Should support updater function like useState
   */
  it('should support updater function like useState', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 0));

    // Update using updater function
    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    // Verify state incremented
    expect(result.current[0]).toBe(1);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('counter', JSON.stringify(1));

    // Update again using updater function
    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(6);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('counter', JSON.stringify(6));
  });

  /**
   * Test: Should handle complex objects and arrays
   */
  it('should handle complex objects and arrays', () => {
    // Test with complex object
    const complexObject = {
      id: 1,
      name: 'test',
      nested: {
        prop: 'value',
        array: [1, 2, 3],
      },
    };

    const { result: objectResult } = renderHook(() =>
      useLocalStorage('complex-object', complexObject)
    );

    act(() => {
      const updated = { ...complexObject, id: 2 };
      objectResult.current[1](updated);
    });

    expect(objectResult.current[0]).toEqual({ ...complexObject, id: 2 });
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'complex-object',
      JSON.stringify({ ...complexObject, id: 2 })
    );

    // Test with array
    const { result: arrayResult } = renderHook(() =>
      useLocalStorage<number[]>('array-key', [])
    );

    act(() => {
      arrayResult.current[1]([1, 2, { id: 3 } as any]);
    });

    expect(arrayResult.current[0]).toEqual([1, 2, { id: 3 }]);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'array-key',
      JSON.stringify([1, 2, { id: 3 }])
    );
  });

  /**
   * Test: Should remove value from state and localStorage
   */
  it('should remove value from state and localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Set a value first
    act(() => {
      result.current[1]('some-value');
    });

    expect(result.current[0]).toBe('some-value');

    // Remove the value
    act(() => {
      result.current[2](); // removeValue function
    });

    // Verify state reset to initial value
    expect(result.current[0]).toBe('initial');

    // Verify localStorage.removeItem was called
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
  });

  /**
   * Test: Should handle localStorage quota exceeded error
   */
  it('should handle localStorage quota exceeded error', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Mock setItem to throw QuotaExceededError
    const quotaError = new Error('QuotaExceededError');
    quotaError.name = 'QuotaExceededError';
    vi.mocked(mockLocalStorage.setItem).mockImplementationOnce(() => {
      throw quotaError;
    });

    // Spy on console.error to verify error is logged
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Call setValue - should not crash
    act(() => {
      result.current[1]('new-value');
    });

    // State should still update even though localStorage failed
    expect(result.current[0]).toBe('new-value');

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  /**
   * Test: Should handle invalid JSON in localStorage
   */
  it('should handle invalid JSON in localStorage', () => {
    // Pre-populate with invalid JSON
    mockStorage.set('test-key', 'invalid-json{');

    // Spy on console.error to verify error is logged
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));

    // Should fall back to initial value
    expect(result.current[0]).toBe('fallback');

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  /**
   * Test: Should synchronize across tabs via storage event
   */
  it('should synchronize across tabs via storage event', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Verify initial value
    expect(result.current[0]).toBe('initial');

    // Simulate storage event from another tab
    const newValue = 'updated-from-another-tab';
    const storageEvent = new StorageEvent('storage', {
      key: 'test-key',
      newValue: JSON.stringify(newValue),
      oldValue: JSON.stringify('initial'),
      storageArea: window.localStorage,
      url: 'http://localhost',
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    // Verify hook state updated to new value
    expect(result.current[0]).toBe(newValue);
  });

  /**
   * Test: Should handle storage event with null value (removal from another tab)
   */
  it('should handle storage event with null value (removal from another tab)', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Set a value first
    act(() => {
      result.current[1]('current-value');
    });

    expect(result.current[0]).toBe('current-value');

    // Simulate removal in another tab (newValue is null)
    const storageEvent = new StorageEvent('storage', {
      key: 'test-key',
      newValue: null,
      oldValue: JSON.stringify('current-value'),
      storageArea: window.localStorage,
      url: 'http://localhost',
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    // Verify state reset to initial value
    expect(result.current[0]).toBe('initial');
  });

  /**
   * Test: Should ignore storage events for different keys
   */
  it('should ignore storage events for different keys', () => {
    const { result } = renderHook(() => useLocalStorage('test-key-1', 'initial'));

    // Set a value
    act(() => {
      result.current[1]('value-1');
    });

    expect(result.current[0]).toBe('value-1');

    // Simulate storage event for a different key
    const storageEvent = new StorageEvent('storage', {
      key: 'test-key-2', // Different key
      newValue: JSON.stringify('value-2'),
      storageArea: window.localStorage,
      url: 'http://localhost',
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    // State should not change
    expect(result.current[0]).toBe('value-1');
  });

  /**
   * Test: Should handle SSR where localStorage is undefined
   */
  it('should handle SSR where localStorage is undefined', () => {
    // Temporarily remove window.localStorage
    const originalLocalStorage = window.localStorage;
    // @ts-ignore - Simulating SSR environment
    delete window.localStorage;

    const { result } = renderHook(() => useLocalStorage('test-key', 'ssr-initial'));

    // Should return initial value without errors
    expect(result.current[0]).toBe('ssr-initial');

    // Calling setValue should not crash
    act(() => {
      result.current[1]('new-value');
    });

    // State should update but localStorage operations are skipped
    expect(result.current[0]).toBe('new-value');

    // Restore localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  /**
   * Test: Should cleanup storage event listener on unmount
   */
  it('should cleanup storage event listener on unmount', () => {
    // Spy on addEventListener and removeEventListener
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Verify addEventListener was called with 'storage'
    expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    // Unmount the hook
    unmount();

    // Verify removeEventListener was called with 'storage'
    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  /**
   * Test: Should work with different types (string, number, boolean, null)
   */
  it('should work with different types', () => {
    // Test with string
    const { result: stringResult } = renderHook(() => useLocalStorage('string-key', 'test'));
    act(() => {
      stringResult.current[1]('updated');
    });
    expect(stringResult.current[0]).toBe('updated');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('string-key', JSON.stringify('updated'));

    // Test with number
    const { result: numberResult } = renderHook(() => useLocalStorage('number-key', 42));
    act(() => {
      numberResult.current[1](100);
    });
    expect(numberResult.current[0]).toBe(100);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('number-key', JSON.stringify(100));

    // Test with boolean
    const { result: booleanResult } = renderHook(() => useLocalStorage('boolean-key', false));
    act(() => {
      booleanResult.current[1](true);
    });
    expect(booleanResult.current[0]).toBe(true);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('boolean-key', JSON.stringify(true));

    // Test with null
    const { result: nullResult } = renderHook(() => useLocalStorage<string | null>('null-key', null));
    act(() => {
      nullResult.current[1]('value');
    });
    expect(nullResult.current[0]).toBe('value');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('null-key', JSON.stringify('value'));

    // Test with undefined (should use initial value)
    const { result: undefinedResult } = renderHook(() =>
      useLocalStorage<string | undefined>('undefined-key', undefined)
    );
    expect(undefinedResult.current[0]).toBeUndefined();
  });

  /**
   * Test: Should handle localStorage getItem throwing an error
   */
  it('should handle localStorage getItem throwing an error', () => {
    // Mock getItem to throw an error (simulating localStorage disabled)
    vi.mocked(mockLocalStorage.getItem).mockImplementationOnce(() => {
      throw new Error('localStorage is disabled');
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));

    // Should return initial value without crashing
    expect(result.current[0]).toBe('fallback');

    // Verify warning was logged
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  /**
   * Test: Should handle storage event with invalid JSON
   */
  it('should handle storage event with invalid JSON', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Simulate storage event with invalid JSON
    const storageEvent = new StorageEvent('storage', {
      key: 'test-key',
      newValue: 'invalid-json{',
      storageArea: window.localStorage,
      url: 'http://localhost',
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    // State should remain unchanged
    expect(result.current[0]).toBe('initial');

    // Verify warning was logged
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  /**
   * Test: Should handle removeItem throwing an error
   */
  it('should handle removeItem throwing an error', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Set a value first
    act(() => {
      result.current[1]('value');
    });

    // Mock removeItem to throw an error
    vi.mocked(mockLocalStorage.removeItem).mockImplementationOnce(() => {
      throw new Error('removeItem failed');
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Call removeValue - should not crash
    act(() => {
      result.current[2]();
    });

    // State should still reset to initial value
    expect(result.current[0]).toBe('initial');

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  /**
   * Test: Should handle complex type with TypeScript generics
   */
  it('should handle complex type with TypeScript generics', () => {
    interface User {
      id: number;
      name: string;
      email: string;
      preferences: {
        theme: 'light' | 'dark';
        notifications: boolean;
      };
    }

    const initialUser: User = {
      id: 0,
      name: '',
      email: '',
      preferences: {
        theme: 'light',
        notifications: true,
      },
    };

    const { result } = renderHook(() => useLocalStorage<User>('user', initialUser));

    const newUser: User = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      preferences: {
        theme: 'dark',
        notifications: false,
      },
    };

    act(() => {
      result.current[1](newUser);
    });

    expect(result.current[0]).toEqual(newUser);
    expect(result.current[0].preferences.theme).toBe('dark');
  });

  /**
   * Test: Should handle updater function with complex objects
   */
  it('should handle updater function with complex objects', () => {
    interface Counter {
      count: number;
      history: number[];
    }

    const { result } = renderHook(() =>
      useLocalStorage<Counter>('counter', { count: 0, history: [] })
    );

    // Update using updater function
    act(() => {
      result.current[1]((prev) => ({
        count: prev.count + 1,
        history: [...prev.history, prev.count],
      }));
    });

    expect(result.current[0]).toEqual({
      count: 1,
      history: [0],
    });

    // Update again
    act(() => {
      result.current[1]((prev) => ({
        count: prev.count + 1,
        history: [...prev.history, prev.count],
      }));
    });

    expect(result.current[0]).toEqual({
      count: 2,
      history: [0, 1],
    });
  });

  /**
   * Test: Should persist and restore array of objects
   */
  it('should persist and restore array of objects', () => {
    interface Item {
      id: number;
      name: string;
    }

    const items: Item[] = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ];

    // Pre-populate localStorage
    mockStorage.set('items', JSON.stringify(items));

    const { result } = renderHook(() => useLocalStorage<Item[]>('items', []));

    // Should restore the array from localStorage
    expect(result.current[0]).toEqual(items);
    expect(result.current[0].length).toBe(2);
    expect(result.current[0][0].name).toBe('Item 1');
  });

  /**
   * Test: Multiple hooks with different keys should work independently
   */
  it('should support multiple independent hooks', () => {
    const { result: result1 } = renderHook(() => useLocalStorage('key1', 'value1'));
    const { result: result2 } = renderHook(() => useLocalStorage('key2', 'value2'));

    // Initial values should be different
    expect(result1.current[0]).toBe('value1');
    expect(result2.current[0]).toBe('value2');

    // Update first hook
    act(() => {
      result1.current[1]('updated1');
    });

    // Only first hook should change
    expect(result1.current[0]).toBe('updated1');
    expect(result2.current[0]).toBe('value2');

    // Update second hook
    act(() => {
      result2.current[1]('updated2');
    });

    expect(result1.current[0]).toBe('updated1');
    expect(result2.current[0]).toBe('updated2');
  });
});

