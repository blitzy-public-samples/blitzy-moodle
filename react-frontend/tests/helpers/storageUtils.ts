/**
 * Storage Testing Utilities
 * 
 * Comprehensive utilities for mocking and testing localStorage and sessionStorage
 * interactions in browser environment tests. Provides helper functions to setup/teardown
 * storage mocks, assert storage operations, clear storage between tests, and simulate
 * storage quota exceeded scenarios.
 * 
 * @module tests/helpers/storageUtils
 */

import { expect } from 'vitest';

/**
 * Mock storage implementation using Map
 */
class MockStorage implements Storage {
  private store: Map<string, string> = new Map();
  private quotaExceeded = false;

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.quotaExceeded) {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  setQuotaExceeded(exceeded: boolean): void {
    this.quotaExceeded = exceeded;
  }
}

/**
 * Original storage references for restoration
 */
let originalLocalStorage: Storage | undefined;
let originalSessionStorage: Storage | undefined;

/**
 * Mock storage instances
 */
let mockLocalStorage: MockStorage | undefined;
let mockSessionStorage: MockStorage | undefined;

/**
 * Initialize mock storage implementation for both localStorage and sessionStorage.
 * Should be called in beforeEach or at the start of tests that need storage mocking.
 * Replaces global localStorage and sessionStorage with mock implementations.
 * 
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupStorageMock();
 * });
 * ```
 */
export function setupStorageMock(): void {
  // Store original storage references
  originalLocalStorage = global.localStorage;
  originalSessionStorage = global.sessionStorage;

  // Create mock storage instances
  mockLocalStorage = new MockStorage();
  mockSessionStorage = new MockStorage();

  // Replace global storage with mocks
  Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(global, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
    configurable: true,
  });
}

/**
 * Clear both localStorage and sessionStorage mock implementations.
 * Should be called between tests to ensure clean state.
 * 
 * @example
 * ```typescript
 * afterEach(() => {
 *   clearAllStorage();
 * });
 * ```
 */
export function clearAllStorage(): void {
  if (mockLocalStorage) {
    mockLocalStorage.clear();
  }
  if (mockSessionStorage) {
    mockSessionStorage.clear();
  }

  // Also clear globals if they exist
  global.localStorage?.clear();
  global.sessionStorage?.clear();
}

/**
 * Restore original storage implementation, removing mocks.
 * Should be called in afterAll or when storage mocking is no longer needed.
 * 
 * @example
 * ```typescript
 * afterAll(() => {
 *   restoreStorage();
 * });
 * ```
 */
export function restoreStorage(): void {
  if (originalLocalStorage) {
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  }

  if (originalSessionStorage) {
    Object.defineProperty(global, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true,
      configurable: true,
    });
  }

  // Clear references
  mockLocalStorage = undefined;
  mockSessionStorage = undefined;
  originalLocalStorage = undefined;
  originalSessionStorage = undefined;
}

/**
 * Assert that localStorage contains a specific item with expected value.
 * Automatically handles JSON parsing for object values.
 * 
 * @param key - Storage key to check
 * @param value - Expected value (can be string, object, array, etc.)
 * 
 * @example
 * ```typescript
 * expectLocalStorageItem('user', { id: 1, name: 'John' });
 * expectLocalStorageItem('token', 'abc123');
 * ```
 */
export function expectLocalStorageItem(key: string, value: unknown): void {
  const storedValue = localStorage.getItem(key);
  
  if (storedValue === null) {
    throw new Error(`Expected localStorage to contain key "${key}", but it was not found`);
  }

  // Try to parse as JSON, fallback to string comparison
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(storedValue);
  } catch {
    parsedValue = storedValue;
  }

  expect(parsedValue).toEqual(value);
}

/**
 * Assert that sessionStorage contains a specific item with expected value.
 * Automatically handles JSON parsing for object values.
 * 
 * @param key - Storage key to check
 * @param value - Expected value (can be string, object, array, etc.)
 * 
 * @example
 * ```typescript
 * expectSessionStorageItem('tempData', { id: 1 });
 * expectSessionStorageItem('sessionId', 'xyz789');
 * ```
 */
export function expectSessionStorageItem(key: string, value: unknown): void {
  const storedValue = sessionStorage.getItem(key);
  
  if (storedValue === null) {
    throw new Error(`Expected sessionStorage to contain key "${key}", but it was not found`);
  }

  // Try to parse as JSON, fallback to string comparison
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(storedValue);
  } catch {
    parsedValue = storedValue;
  }

  expect(parsedValue).toEqual(value);
}

/**
 * Assert that storage is empty (contains no items).
 * 
 * @param type - Which storage to check: 'local', 'session', or 'both' (default)
 * 
 * @example
 * ```typescript
 * expectStorageToBeEmpty(); // Checks both
 * expectStorageToBeEmpty('local'); // Only localStorage
 * expectStorageToBeEmpty('session'); // Only sessionStorage
 * ```
 */
export function expectStorageToBeEmpty(type: 'local' | 'session' | 'both' = 'both'): void {
  if (type === 'local' || type === 'both') {
    expect(localStorage.length).toBe(0);
  }

  if (type === 'session' || type === 'both') {
    expect(sessionStorage.length).toBe(0);
  }
}

/**
 * Assert that storage contains a specific key.
 * 
 * @param key - Storage key to check for existence
 * @param type - Which storage to check: 'local' or 'session' (default: 'local')
 * 
 * @example
 * ```typescript
 * expectStorageToContainKey('authToken');
 * expectStorageToContainKey('sessionData', 'session');
 * ```
 */
export function expectStorageToContainKey(key: string, type: 'local' | 'session' = 'local'): void {
  const storage = type === 'local' ? localStorage : sessionStorage;
  const value = storage.getItem(key);
  
  if (value === null) {
    throw new Error(`Expected ${type}Storage to contain key "${key}", but it was not found`);
  }
}

/**
 * Set an item in localStorage with automatic JSON stringification for objects.
 * 
 * @param key - Storage key
 * @param value - Value to store (automatically stringified if object)
 * 
 * @example
 * ```typescript
 * setLocalStorageItem('user', { id: 1, name: 'John' });
 * setLocalStorageItem('token', 'abc123');
 * ```
 */
export function setLocalStorageItem(key: string, value: unknown): void {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(key, stringValue);
}

/**
 * Set an item in sessionStorage with automatic JSON stringification for objects.
 * 
 * @param key - Storage key
 * @param value - Value to store (automatically stringified if object)
 * 
 * @example
 * ```typescript
 * setSessionStorageItem('tempData', { id: 1 });
 * setSessionStorageItem('sessionId', 'xyz789');
 * ```
 */
export function setSessionStorageItem(key: string, value: unknown): void {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  sessionStorage.setItem(key, stringValue);
}

/**
 * Get an item from localStorage with automatic JSON parsing.
 * Returns null if key doesn't exist.
 * 
 * @param key - Storage key
 * @returns Parsed value or null if not found
 * 
 * @example
 * ```typescript
 * const user = getLocalStorageItem('user');
 * const token = getLocalStorageItem('token');
 * ```
 */
export function getLocalStorageItem(key: string): unknown {
  const value = localStorage.getItem(key);
  
  if (value === null) {
    return null;
  }

  // Try to parse as JSON, fallback to string
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Get an item from sessionStorage with automatic JSON parsing.
 * Returns null if key doesn't exist.
 * 
 * @param key - Storage key
 * @returns Parsed value or null if not found
 * 
 * @example
 * ```typescript
 * const tempData = getSessionStorageItem('tempData');
 * const sessionId = getSessionStorageItem('sessionId');
 * ```
 */
export function getSessionStorageItem(key: string): unknown {
  const value = sessionStorage.getItem(key);
  
  if (value === null) {
    return null;
  }

  // Try to parse as JSON, fallback to string
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Remove an item from localStorage.
 * 
 * @param key - Storage key to remove
 * 
 * @example
 * ```typescript
 * removeLocalStorageItem('authToken');
 * ```
 */
export function removeLocalStorageItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Remove an item from sessionStorage.
 * 
 * @param key - Storage key to remove
 * 
 * @example
 * ```typescript
 * removeSessionStorageItem('tempData');
 * ```
 */
export function removeSessionStorageItem(key: string): void {
  sessionStorage.removeItem(key);
}

/**
 * Simulate a storage event for testing cross-tab communication.
 * Dispatches a StorageEvent on the window object with the specified parameters.
 * 
 * @param key - Storage key that changed
 * @param newValue - New value (null if removed)
 * @param oldValue - Previous value (optional)
 * 
 * @example
 * ```typescript
 * // Simulate item update
 * simulateStorageEvent('user', '{"id":2}', '{"id":1}');
 * 
 * // Simulate item removal
 * simulateStorageEvent('token', null, 'abc123');
 * ```
 */
export function simulateStorageEvent(
  key: string,
  newValue: string | null,
  oldValue: string | null = null
): void {
  const event = new StorageEvent('storage', {
    key,
    newValue,
    oldValue,
    url: window.location.href,
    // storageArea must be null in testing environment to avoid TypeError
    // The mocked storage is not a true Storage instance
    storageArea: null,
  });

  window.dispatchEvent(event);
}

/**
 * Mock storage to throw QuotaExceededError on setItem calls.
 * Useful for testing error handling when storage quota is exceeded.
 * 
 * @example
 * ```typescript
 * mockStorageQuotaExceeded();
 * expect(() => localStorage.setItem('key', 'value')).toThrow('QuotaExceededError');
 * restoreStorageQuota();
 * ```
 */
export function mockStorageQuotaExceeded(): void {
  if (mockLocalStorage) {
    mockLocalStorage.setQuotaExceeded(true);
  }
  if (mockSessionStorage) {
    mockSessionStorage.setQuotaExceeded(true);
  }
}

/**
 * Restore normal storage behavior after mocking quota exceeded.
 * 
 * @example
 * ```typescript
 * mockStorageQuotaExceeded();
 * // ... test quota exceeded behavior
 * restoreStorageQuota();
 * // ... continue with normal storage operations
 * ```
 */
export function restoreStorageQuota(): void {
  if (mockLocalStorage) {
    mockLocalStorage.setQuotaExceeded(false);
  }
  if (mockSessionStorage) {
    mockSessionStorage.setQuotaExceeded(false);
  }
}

/**
 * Capture current state of both localStorage and sessionStorage.
 * Returns an object containing all key-value pairs from both storages.
 * 
 * @returns Object containing localStorage and sessionStorage snapshots
 * 
 * @example
 * ```typescript
 * const snapshot = createStorageSnapshot();
 * // ... modify storage
 * restoreStorageSnapshot(snapshot);
 * ```
 */
export function createStorageSnapshot(): {
  localStorage: Record<string, unknown>;
  sessionStorage: Record<string, unknown>;
} {
  const localStorageSnapshot: Record<string, unknown> = {};
  const sessionStorageSnapshot: Record<string, unknown> = {};

  // Capture localStorage with parsed values
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) {
      const value = getLocalStorageItem(key);
      if (value !== null) {
        localStorageSnapshot[key] = value;
      }
    }
  }

  // Capture sessionStorage with parsed values
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key !== null) {
      const value = getSessionStorageItem(key);
      if (value !== null) {
        sessionStorageSnapshot[key] = value;
      }
    }
  }

  return {
    localStorage: localStorageSnapshot,
    sessionStorage: sessionStorageSnapshot,
  };
}

/**
 * Restore storage to a previously captured snapshot.
 * Clears current storage and restores all key-value pairs from the snapshot.
 * 
 * @param snapshot - Snapshot object created by createStorageSnapshot()
 * 
 * @example
 * ```typescript
 * const snapshot = createStorageSnapshot();
 * // ... test operations that modify storage
 * restoreStorageSnapshot(snapshot); // Restore to original state
 * ```
 */
export function restoreStorageSnapshot(snapshot: {
  localStorage: Record<string, unknown>;
  sessionStorage: Record<string, unknown>;
}): void {
  // Clear current storage
  localStorage.clear();
  sessionStorage.clear();

  // Restore localStorage with proper JSON serialization
  Object.entries(snapshot.localStorage).forEach(([key, value]) => {
    setLocalStorageItem(key, value);
  });

  // Restore sessionStorage with proper JSON serialization
  Object.entries(snapshot.sessionStorage).forEach(([key, value]) => {
    setSessionStorageItem(key, value);
  });
}
