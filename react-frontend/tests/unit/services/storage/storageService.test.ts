/**
 * Comprehensive unit tests for storageService.ts
 *
 * Validates type-safe localStorage and sessionStorage wrapper functions including:
 * - Storage availability detection (MDL-51461 pattern)
 * - Type-safe get/set operations with JSON serialization/deserialization
 * - Error handling for quota exceeded and unavailable storage
 * - Cross-tab synchronization via storage event listeners
 * - In-memory fallback mechanism
 * - Consistent API across both storage implementations
 *
 * @module tests/unit/services/storage/storageService.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import types for TypeScript
type StorageService = typeof import('@/services/storage/storageService');

/**
 * Mock Storage class implementing the Storage interface
 * Allows simulation of various storage states and errors
 */
class MockStorage implements Storage {
  private store: Map<string, string> = new Map();
  private shouldThrowQuotaError = false;
  private shouldThrowSecurityError = false;
  private isUnavailable = false;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    if (this.isUnavailable) {
      throw new DOMException('Storage unavailable', 'SecurityError');
    }
    this.store.clear();
  }

  getItem(key: string): string | null {
    if (this.isUnavailable) {
      throw new DOMException('Storage unavailable', 'SecurityError');
    }
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    if (this.isUnavailable) {
      throw new DOMException('Storage unavailable', 'SecurityError');
    }
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    if (this.isUnavailable) {
      throw new DOMException('Storage unavailable', 'SecurityError');
    }
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.isUnavailable) {
      throw new DOMException('Storage unavailable', 'SecurityError');
    }
    // SecurityError should always throw - it means storage is completely inaccessible
    if (this.shouldThrowSecurityError) {
      throw new DOMException('Security error', 'SecurityError');
    }
    // QuotaExceededError should only throw for non-test keys
    // This allows isStorageAvailable() to succeed (storage is available)
    // while actual data writes fail (storage is full)
    if (this.shouldThrowQuotaError && key !== '__storage_test__') {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    }
    this.store.set(key, value);
  }

  // Test helper methods
  setQuotaExceededError(shouldThrow: boolean): void {
    this.shouldThrowQuotaError = shouldThrow;
  }

  setSecurityError(shouldThrow: boolean): void {
    this.shouldThrowSecurityError = shouldThrow;
  }

  setUnavailable(unavailable: boolean): void {
    this.isUnavailable = unavailable;
  }

  // Helper to inspect stored data in tests
  getStore(): Map<string, string> {
    return this.store;
  }
}

describe('storageService', () => {
  let mockLocalStorage: MockStorage;
  let mockSessionStorage: MockStorage;
  let originalLocalStorage: Storage;
  let originalSessionStorage: Storage;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  
  // Storage service functions (dynamically imported in beforeEach)
  let getItem: StorageService['getItem'];
  let setItem: StorageService['setItem'];
  let removeItem: StorageService['removeItem'];
  let isStorageAvailable: StorageService['isStorageAvailable'];
  let clear: StorageService['clear'];
  let getKeys: StorageService['getKeys'];
  let addStorageListener: StorageService['addStorageListener'];
  let removeStorageListener: StorageService['removeStorageListener'];

  beforeEach(async () => {
    // Create fresh mock storage instances
    mockLocalStorage = new MockStorage();
    mockSessionStorage = new MockStorage();

    // Store original storage objects
    originalLocalStorage = window.localStorage;
    originalSessionStorage = window.sessionStorage;

    // Replace global storage with mocks
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });

    // Spy on console methods to suppress expected error logs
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Reset module state to clear any cached availability results
    // This ensures each test starts with a fresh module state
    vi.resetModules();
    
    // Dynamically import storage service to get fresh module after reset
    const storageService = await import('@/services/storage/storageService');
    getItem = storageService.getItem;
    setItem = storageService.setItem;
    removeItem = storageService.removeItem;
    isStorageAvailable = storageService.isStorageAvailable;
    clear = storageService.clear;
    getKeys = storageService.getKeys;
    addStorageListener = storageService.addStorageListener;
    removeStorageListener = storageService.removeStorageListener;
  });

  afterEach(() => {
    // Restore original storage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true,
      configurable: true,
    });

    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('isStorageAvailable', () => {
    describe('localStorage', () => {
      it('should return true when localStorage is accessible and usable', () => {
        const result = isStorageAvailable('local');
        expect(result).toBe(true);
      });

      it('should return false when localStorage is null', () => {
        Object.defineProperty(window, 'localStorage', {
          value: null,
          writable: true,
          configurable: true,
        });

        const result = isStorageAvailable('local');
        expect(result).toBe(false);
      });

      it('should return false when localStorage is undefined', () => {
        Object.defineProperty(window, 'localStorage', {
          value: undefined,
          writable: true,
          configurable: true,
        });

        const result = isStorageAvailable('local');
        expect(result).toBe(false);
      });

      it('should return false when localStorage throws SecurityError (private browsing)', () => {
        mockLocalStorage.setSecurityError(true);

        const result = isStorageAvailable('local');
        expect(result).toBe(false);
      });

      it('should actually test storage usability with setItem/removeItem (MDL-51461)', () => {
        // Ensure the test key is used
        const setItemSpy = vi.spyOn(mockLocalStorage, 'setItem');
        const removeItemSpy = vi.spyOn(mockLocalStorage, 'removeItem');

        isStorageAvailable('local');

        expect(setItemSpy).toHaveBeenCalledWith('__storage_test__', 'test');
        expect(removeItemSpy).toHaveBeenCalledWith('__storage_test__');
      });

      it('should cache availability result to avoid repeated checks', () => {
        const setItemSpy = vi.spyOn(mockLocalStorage, 'setItem');

        // First call
        isStorageAvailable('local');
        const firstCallCount = setItemSpy.mock.calls.length;

        // Second call should use cached result
        isStorageAvailable('local');
        const secondCallCount = setItemSpy.mock.calls.length;

        expect(secondCallCount).toBe(firstCallCount);
      });
    });

    describe('sessionStorage', () => {
      it('should return true when sessionStorage is accessible and usable', () => {
        const result = isStorageAvailable('session');
        expect(result).toBe(true);
      });

      it('should return false when sessionStorage is null', () => {
        Object.defineProperty(window, 'sessionStorage', {
          value: null,
          writable: true,
          configurable: true,
        });

        const result = isStorageAvailable('session');
        expect(result).toBe(false);
      });

      it('should return false when sessionStorage throws SecurityError', () => {
        mockSessionStorage.setSecurityError(true);

        const result = isStorageAvailable('session');
        expect(result).toBe(false);
      });

      it('should actually test storage usability with setItem/removeItem', () => {
        const setItemSpy = vi.spyOn(mockSessionStorage, 'setItem');
        const removeItemSpy = vi.spyOn(mockSessionStorage, 'removeItem');

        isStorageAvailable('session');

        expect(setItemSpy).toHaveBeenCalledWith('__storage_test__', 'test');
        expect(removeItemSpy).toHaveBeenCalledWith('__storage_test__');
      });
    });
  });

  describe('getItem', () => {
    describe('localStorage', () => {
      it('should retrieve and parse JSON data correctly with TypeScript generics', () => {
        interface User {
          id: number;
          name: string;
          active: boolean;
        }

        const user: User = { id: 1, name: 'John Doe', active: true };
        mockLocalStorage.setItem('user', JSON.stringify(user));

        const result = getItem<User>('user', 'local');

        expect(result).toEqual(user);
        expect(result?.id).toBe(1);
        expect(result?.name).toBe('John Doe');
        expect(result?.active).toBe(true);
      });

      it('should return null for non-existent keys', () => {
        const result = getItem<string>('nonexistent', 'local');
        expect(result).toBeNull();
      });

      it('should handle JSON parse errors gracefully', () => {
        // Store invalid JSON
        mockLocalStorage.setItem('invalid', 'not-valid-json{');

        const result = getItem<unknown>('invalid', 'local');

        // Should return the raw value when parsing fails
        expect(result).toBe('not-valid-json{');
      });

      it('should return type-safe values matching the generic type parameter', () => {
        const numberValue = 42;
        mockLocalStorage.setItem('number', JSON.stringify(numberValue));

        const result = getItem<number>('number', 'local');

        expect(result).toBe(numberValue);
        expect(typeof result).toBe('number');
      });

      it('should handle complex nested objects', () => {
        interface ComplexData {
          user: {
            id: number;
            profile: {
              name: string;
              tags: string[];
            };
          };
          settings: Record<string, boolean>;
        }

        const complexData: ComplexData = {
          user: {
            id: 1,
            profile: {
              name: 'Jane',
              tags: ['admin', 'teacher'],
            },
          },
          settings: {
            emailNotifications: true,
            darkMode: false,
          },
        };

        mockLocalStorage.setItem('complex', JSON.stringify(complexData));

        const result = getItem<ComplexData>('complex', 'local');

        expect(result).toEqual(complexData);
        expect(result?.user.profile.tags).toEqual(['admin', 'teacher']);
      });

      it('should handle arrays correctly', () => {
        const arrayData = [1, 2, 3, 4, 5];
        mockLocalStorage.setItem('array', JSON.stringify(arrayData));

        const result = getItem<number[]>('array', 'local');

        expect(result).toEqual(arrayData);
        expect(Array.isArray(result)).toBe(true);
      });

      it('should handle boolean values', () => {
        mockLocalStorage.setItem('flag', JSON.stringify(true));

        const result = getItem<boolean>('flag', 'local');

        expect(result).toBe(true);
        expect(typeof result).toBe('boolean');
      });

      it('should handle null values', () => {
        mockLocalStorage.setItem('nullable', JSON.stringify(null));

        const result = getItem<null>('nullable', 'local');

        expect(result).toBeNull();
      });

      it('should fall back to in-memory storage when localStorage is unavailable', () => {
        mockLocalStorage.setUnavailable(true);

        // This will trigger in-memory fallback, but won't have the key
        const result = getItem<string>('test', 'local');

        expect(result).toBeNull();
      });
    });

    describe('sessionStorage', () => {
      it('should retrieve and parse JSON data correctly from sessionStorage', () => {
        interface Session {
          token: string;
          expiresAt: number;
        }

        const session: Session = { token: 'abc123', expiresAt: 1234567890 };
        mockSessionStorage.setItem('session', JSON.stringify(session));

        const result = getItem<Session>('session', 'session');

        expect(result).toEqual(session);
      });

      it('should return null for non-existent keys in sessionStorage', () => {
        const result = getItem<string>('nonexistent', 'session');
        expect(result).toBeNull();
      });

      it('should work consistently with localStorage', () => {
        const testData = { value: 'test' };

        mockLocalStorage.setItem('data', JSON.stringify(testData));
        mockSessionStorage.setItem('data', JSON.stringify(testData));

        const localResult = getItem<typeof testData>('data', 'local');
        const sessionResult = getItem<typeof testData>('data', 'session');

        expect(localResult).toEqual(sessionResult);
      });
    });
  });

  describe('setItem', () => {
    describe('localStorage', () => {
      it('should store data with automatic JSON stringification', () => {
        interface User {
          id: number;
          name: string;
        }

        const user: User = { id: 1, name: 'John' };
        const success = setItem('user', user, 'local');

        expect(success).toBe(true);

        const stored = mockLocalStorage.getItem('user');
        expect(stored).toBe(JSON.stringify(user));
      });

      it('should preserve data types (strings, numbers, booleans, objects, arrays)', () => {
        const testCases: Array<{ key: string; value: unknown }> = [
          { key: 'string', value: 'hello' },
          { key: 'number', value: 42 },
          { key: 'boolean', value: true },
          { key: 'object', value: { a: 1, b: 2 } },
          { key: 'array', value: [1, 2, 3] },
          { key: 'null', value: null },
        ];

        testCases.forEach(({ key, value }) => {
          const success = setItem(key, value, 'local');
          expect(success).toBe(true);

          const retrieved = getItem(key, 'local');
          expect(retrieved).toEqual(value);
        });
      });

      it('should handle circular references in objects', () => {
        interface CircularRef {
          name: string;
          self?: CircularRef;
        }

        const circularObj: CircularRef = { name: 'test' };
        circularObj.self = circularObj;

        const success = setItem('circular', circularObj, 'local');

        // Should fail gracefully due to JSON.stringify error
        expect(success).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should return success boolean indicating operation result', () => {
        const successResult = setItem('key', 'value', 'local');
        expect(successResult).toBe(true);

        // Trigger quota error
        mockLocalStorage.setQuotaExceededError(true);
        const failureResult = setItem('key2', 'value2', 'local');
        expect(failureResult).toBe(false);
      });

      it('should handle undefined by converting to null', () => {
        const success = setItem('undefined', undefined, 'local');
        expect(success).toBe(true);

        const stored = mockLocalStorage.getItem('undefined');
        expect(stored).toBe('null');
      });
    });

    describe('sessionStorage', () => {
      it('should store data in sessionStorage with JSON stringification', () => {
        const data = { session: 'active' };
        const success = setItem('session', data, 'session');

        expect(success).toBe(true);

        const stored = mockSessionStorage.getItem('session');
        expect(stored).toBe(JSON.stringify(data));
      });

      it('should work consistently with localStorage', () => {
        const data = { value: 'test' };

        const localSuccess = setItem('data', data, 'local');
        const sessionSuccess = setItem('data', data, 'session');

        expect(localSuccess).toBe(sessionSuccess);

        const localStored = mockLocalStorage.getItem('data');
        const sessionStored = mockSessionStorage.getItem('data');

        expect(localStored).toBe(sessionStored);
      });
    });

    describe('quota exceeded error handling', () => {
      it('should catch QuotaExceededError when storage limit reached', () => {
        mockLocalStorage.setQuotaExceededError(true);

        const success = setItem('large', 'data', 'local');

        expect(success).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Storage quota exceeded')
        );
      });

      it('should return false when quota exceeded', () => {
        mockLocalStorage.setQuotaExceededError(true);

        const result = setItem('key', 'value', 'local');

        expect(result).toBe(false);
      });

      it('should provide meaningful error messages for quota issues', () => {
        mockLocalStorage.setQuotaExceededError(true);

        setItem('testKey', 'value', 'local');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Storage quota exceeded for localStorage')
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Key: "testKey"'));
      });

      it('should handle quota exceeded identically for localStorage and sessionStorage', () => {
        mockLocalStorage.setQuotaExceededError(true);
        mockSessionStorage.setQuotaExceededError(true);

        const localResult = setItem('key', 'value', 'local');
        const sessionResult = setItem('key', 'value', 'session');

        expect(localResult).toBe(false);
        expect(sessionResult).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      });

      it('should handle NS_ERROR_DOM_QUOTA_REACHED (Firefox variant)', () => {
        const firefoxQuotaError = new DOMException(
          'Quota reached',
          'NS_ERROR_DOM_QUOTA_REACHED'
        );

        // Mock setItem to throw only for non-test keys
        // This allows isStorageAvailable() to succeed while actual data storage fails
        vi.spyOn(mockLocalStorage, 'setItem').mockImplementation((key: string, value: string) => {
          if (key === '__storage_test__') {
            // Allow test key to succeed so storage is considered available
            mockLocalStorage.getStore().set(key, value);
            return;
          }
          throw firefoxQuotaError;
        });

        const result = setItem('key', 'value', 'local');

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Storage quota exceeded')
        );
      });
    });

    describe('unavailable storage scenarios', () => {
      it('should gracefully handle null storage', () => {
        Object.defineProperty(window, 'localStorage', {
          value: null,
          writable: true,
          configurable: true,
        });

        const result = setItem('key', 'value', 'local');

        // Should use in-memory fallback
        expect(result).toBe(true);
      });

      it('should gracefully handle undefined storage', () => {
        Object.defineProperty(window, 'localStorage', {
          value: undefined,
          writable: true,
          configurable: true,
        });

        const result = setItem('key', 'value', 'local');

        // Should use in-memory fallback
        expect(result).toBe(true);
      });

      it('should handle SecurityError when storage access is denied', () => {
        mockLocalStorage.setSecurityError(true);

        const result = setItem('key', 'value', 'local');

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should use in-memory fallback when storage unavailable', () => {
        mockLocalStorage.setUnavailable(true);

        const setResult = setItem('key', 'value', 'local');
        expect(setResult).toBe(true);

        // Value should be retrievable from in-memory fallback
        const getResult = getItem<string>('key', 'local');
        expect(getResult).toBe('value');
      });
    });
  });

  describe('removeItem', () => {
    describe('localStorage', () => {
      it('should delete specific keys from storage', () => {
        mockLocalStorage.setItem('key1', 'value1');
        mockLocalStorage.setItem('key2', 'value2');

        const success = removeItem('key1', 'local');

        expect(success).toBe(true);
        expect(mockLocalStorage.getItem('key1')).toBeNull();
        expect(mockLocalStorage.getItem('key2')).toBe('value2');
      });

      it('should work when key does not exist (no error)', () => {
        const success = removeItem('nonexistent', 'local');

        expect(success).toBe(true);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('should work with in-memory fallback', () => {
        mockLocalStorage.setUnavailable(true);

        // Set via in-memory fallback
        setItem('key', 'value', 'local');

        // Remove via in-memory fallback
        const success = removeItem('key', 'local');

        expect(success).toBe(true);

        // Verify removal
        const result = getItem<string>('key', 'local');
        expect(result).toBeNull();
      });
    });

    describe('sessionStorage', () => {
      it('should delete specific keys from sessionStorage', () => {
        mockSessionStorage.setItem('key', 'value');

        const success = removeItem('key', 'session');

        expect(success).toBe(true);
        expect(mockSessionStorage.getItem('key')).toBeNull();
      });

      it('should work consistently with localStorage', () => {
        mockLocalStorage.setItem('key', 'value');
        mockSessionStorage.setItem('key', 'value');

        const localSuccess = removeItem('key', 'local');
        const sessionSuccess = removeItem('key', 'session');

        expect(localSuccess).toBe(sessionSuccess);
        expect(mockLocalStorage.getItem('key')).toBeNull();
        expect(mockSessionStorage.getItem('key')).toBeNull();
      });
    });
  });

  describe('clear', () => {
    describe('localStorage', () => {
      it('should remove all items from storage', () => {
        mockLocalStorage.setItem('key1', 'value1');
        mockLocalStorage.setItem('key2', 'value2');
        mockLocalStorage.setItem('key3', 'value3');

        const success = clear('local');

        expect(success).toBe(true);
        expect(mockLocalStorage.length).toBe(0);
        expect(mockLocalStorage.getItem('key1')).toBeNull();
        expect(mockLocalStorage.getItem('key2')).toBeNull();
        expect(mockLocalStorage.getItem('key3')).toBeNull();
      });

      it('should work when storage is already empty', () => {
        const success = clear('local');

        expect(success).toBe(true);
        expect(mockLocalStorage.length).toBe(0);
      });

      it('should affect only localStorage, not sessionStorage', () => {
        mockLocalStorage.setItem('local', 'value');
        mockSessionStorage.setItem('session', 'value');

        clear('local');

        expect(mockLocalStorage.getItem('local')).toBeNull();
        expect(mockSessionStorage.getItem('session')).toBe('value');
      });

      it('should clear in-memory fallback storage', () => {
        mockLocalStorage.setUnavailable(true);

        // Add items to in-memory storage
        setItem('key1', 'value1', 'local');
        setItem('key2', 'value2', 'local');

        // Clear in-memory storage
        const success = clear('local');

        expect(success).toBe(true);

        // Verify cleared
        expect(getItem<string>('key1', 'local')).toBeNull();
        expect(getItem<string>('key2', 'local')).toBeNull();
      });
    });

    describe('sessionStorage', () => {
      it('should remove all items from sessionStorage', () => {
        mockSessionStorage.setItem('key1', 'value1');
        mockSessionStorage.setItem('key2', 'value2');

        const success = clear('session');

        expect(success).toBe(true);
        expect(mockSessionStorage.length).toBe(0);
      });

      it('should affect only sessionStorage, not localStorage', () => {
        mockLocalStorage.setItem('local', 'value');
        mockSessionStorage.setItem('session', 'value');

        clear('session');

        expect(mockLocalStorage.getItem('local')).toBe('value');
        expect(mockSessionStorage.getItem('session')).toBeNull();
      });
    });
  });

  describe('getKeys', () => {
    describe('localStorage', () => {
      it('should return array of all storage keys', () => {
        mockLocalStorage.setItem('key1', 'value1');
        mockLocalStorage.setItem('key2', 'value2');
        mockLocalStorage.setItem('key3', 'value3');

        const keys = getKeys('local');

        expect(keys).toHaveLength(3);
        expect(keys).toContain('key1');
        expect(keys).toContain('key2');
        expect(keys).toContain('key3');
      });

      it('should return empty array when storage is empty', () => {
        const keys = getKeys('local');

        expect(keys).toEqual([]);
        expect(Array.isArray(keys)).toBe(true);
      });

      it('should exclude keys from sessionStorage', () => {
        mockLocalStorage.setItem('local', 'value');
        mockSessionStorage.setItem('session', 'value');

        const localKeys = getKeys('local');

        expect(localKeys).toContain('local');
        expect(localKeys).not.toContain('session');
      });

      it('should work with in-memory fallback', () => {
        mockLocalStorage.setUnavailable(true);

        // Add items via in-memory storage
        setItem('key1', 'value1', 'local');
        setItem('key2', 'value2', 'local');

        const keys = getKeys('local');

        expect(keys).toHaveLength(2);
        expect(keys).toContain('key1');
        expect(keys).toContain('key2');
      });
    });

    describe('sessionStorage', () => {
      it('should return array of all sessionStorage keys', () => {
        mockSessionStorage.setItem('session1', 'value1');
        mockSessionStorage.setItem('session2', 'value2');

        const keys = getKeys('session');

        expect(keys).toHaveLength(2);
        expect(keys).toContain('session1');
        expect(keys).toContain('session2');
      });

      it('should exclude keys from localStorage', () => {
        mockLocalStorage.setItem('local', 'value');
        mockSessionStorage.setItem('session', 'value');

        const sessionKeys = getKeys('session');

        expect(sessionKeys).toContain('session');
        expect(sessionKeys).not.toContain('local');
      });
    });
  });

  describe('addStorageListener and removeStorageListener', () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    });

    it('should register event listener for storage changes', () => {
      const callback = vi.fn();

      addStorageListener(callback);

      expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('should call callback with correct event data when storage changes', () => {
      const callback = vi.fn();
      addStorageListener(callback);

      // Get the registered listener
      const registeredListener = addEventListenerSpy.mock.calls[0][1] as EventListener;

      // Create a mock StorageEvent
      const storageEvent = new StorageEvent('storage', {
        key: 'testKey',
        oldValue: 'oldValue',
        newValue: 'newValue',
        url: 'http://localhost',
        storageArea: window.localStorage,
      });

      // Trigger the listener
      registeredListener(storageEvent);

      expect(callback).toHaveBeenCalledWith(storageEvent);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'testKey',
          oldValue: 'oldValue',
          newValue: 'newValue',
        })
      );
    });

    it('should return cleanup function that removes listener', () => {
      const callback = vi.fn();

      const cleanup = addStorageListener(callback);

      expect(typeof cleanup).toBe('function');

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('should handle multiple listeners independently', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const cleanup1 = addStorageListener(callback1);
      const cleanup2 = addStorageListener(callback2);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

      cleanup1();
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);

      cleanup2();
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
    });

    it('should properly unregister listeners with removeStorageListener', () => {
      const callback = vi.fn();

      addStorageListener(callback);
      const registeredListener = addEventListenerSpy.mock.calls[0][1] as EventListener;

      removeStorageListener(registeredListener);

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', registeredListener);
    });

    it('should not throw when removing non-existent listener', () => {
      const callback = vi.fn();

      expect(() => {
        removeStorageListener(callback);
      }).not.toThrow();
    });

    it('should handle SSR environment gracefully (window undefined)', () => {
      const originalWindow = global.window;

      // Simulate SSR environment
      // @ts-expect-error - Intentionally setting window to undefined for testing
      delete global.window;

      const callback = vi.fn();
      const cleanup = addStorageListener(callback);

      expect(cleanup).toBeDefined();
      expect(typeof cleanup).toBe('function');

      // Cleanup should be no-op
      expect(() => cleanup()).not.toThrow();

      // removeStorageListener should also be no-op
      expect(() => removeStorageListener(callback)).not.toThrow();

      // Restore window
      global.window = originalWindow;
    });

    it('should only fire for StorageEvent instances', () => {
      const callback = vi.fn();
      addStorageListener(callback);

      const registeredListener = addEventListenerSpy.mock.calls[0][1] as EventListener;

      // Create a regular Event (not StorageEvent)
      const regularEvent = new Event('storage');
      registeredListener(regularEvent);

      // Callback should not be called for non-StorageEvent
      expect(callback).not.toHaveBeenCalled();

      // Now trigger with actual StorageEvent
      const storageEvent = new StorageEvent('storage', {
        key: 'test',
        newValue: 'value',
      });
      registeredListener(storageEvent);

      // Now callback should be called
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('cross-storage-type consistency', () => {
    it('should provide identical API for localStorage and sessionStorage', () => {
      const testData = { value: 'test', number: 42 };

      // Set in both storages
      const localSetSuccess = setItem('data', testData, 'local');
      const sessionSetSuccess = setItem('data', testData, 'session');
      expect(localSetSuccess).toBe(sessionSetSuccess);

      // Get from both storages
      const localData = getItem<typeof testData>('data', 'local');
      const sessionData = getItem<typeof testData>('data', 'session');
      expect(localData).toEqual(sessionData);

      // Remove from both storages
      const localRemoveSuccess = removeItem('data', 'local');
      const sessionRemoveSuccess = removeItem('data', 'session');
      expect(localRemoveSuccess).toBe(sessionRemoveSuccess);

      // Verify removal
      expect(getItem('data', 'local')).toBeNull();
      expect(getItem('data', 'session')).toBeNull();
    });

    it('should handle errors consistently across storage types', () => {
      mockLocalStorage.setQuotaExceededError(true);
      mockSessionStorage.setQuotaExceededError(true);

      const localResult = setItem('key', 'value', 'local');
      const sessionResult = setItem('key', 'value', 'session');

      expect(localResult).toBe(sessionResult);
      expect(localResult).toBe(false);
    });

    it('should return consistent types and values across implementations', () => {
      setItem('string', 'hello', 'local');
      setItem('string', 'hello', 'session');

      const localValue = getItem<string>('string', 'local');
      const sessionValue = getItem<string>('string', 'session');

      expect(typeof localValue).toBe(typeof sessionValue);
      expect(localValue).toBe(sessionValue);
    });
  });

  describe('in-memory fallback mechanism', () => {
    it('should use in-memory Map when storage unavailable', () => {
      mockLocalStorage.setUnavailable(true);

      const data = { test: 'value' };
      const setSuccess = setItem('key', data, 'local');

      expect(setSuccess).toBe(true);

      const retrieved = getItem<typeof data>('key', 'local');
      expect(retrieved).toEqual(data);
    });

    it('should support same API as browser storage', () => {
      mockLocalStorage.setUnavailable(true);

      // Test all operations with in-memory fallback
      expect(setItem('key1', 'value1', 'local')).toBe(true);
      expect(getItem<string>('key1', 'local')).toBe('value1');

      expect(setItem('key2', { nested: 'object' }, 'local')).toBe(true);
      expect(getItem<{ nested: string }>('key2', 'local')).toEqual({ nested: 'object' });

      expect(removeItem('key1', 'local')).toBe(true);
      expect(getItem<string>('key1', 'local')).toBeNull();

      const keys = getKeys('local');
      expect(keys).toContain('key2');
      expect(keys).not.toContain('key1');

      expect(clear('local')).toBe(true);
      expect(getKeys('local')).toEqual([]);
    });

    it('should handle all data types correctly in memory', () => {
      mockLocalStorage.setUnavailable(true);

      const testCases: Array<{ key: string; value: unknown }> = [
        { key: 'string', value: 'test' },
        { key: 'number', value: 123 },
        { key: 'boolean', value: true },
        { key: 'object', value: { a: 1 } },
        { key: 'array', value: [1, 2, 3] },
        { key: 'null', value: null },
      ];

      testCases.forEach(({ key, value }) => {
        setItem(key, value, 'local');
        const retrieved = getItem(key, 'local');
        expect(retrieved).toEqual(value);
      });
    });

    it('should maintain separate in-memory stores for local and session', () => {
      mockLocalStorage.setUnavailable(true);
      mockSessionStorage.setUnavailable(true);

      setItem('key', 'local-value', 'local');
      setItem('key', 'session-value', 'session');

      expect(getItem<string>('key', 'local')).toBe('local-value');
      expect(getItem<string>('key', 'session')).toBe('session-value');
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle very large data objects', () => {
      const largeObject = {
        data: new Array(1000).fill({ id: 1, name: 'Test', values: [1, 2, 3, 4, 5] }),
      };

      const success = setItem('large', largeObject, 'local');
      expect(success).toBe(true);

      const retrieved = getItem<typeof largeObject>('large', 'local');
      expect(retrieved).toEqual(largeObject);
    });

    it('should handle special characters in keys', () => {
      const specialKeys = ['key with spaces', 'key/with/slashes', 'key.with.dots', 'key-with-dash'];

      specialKeys.forEach((key) => {
        const success = setItem(key, 'value', 'local');
        expect(success).toBe(true);

        const retrieved = getItem<string>(key, 'local');
        expect(retrieved).toBe('value');
      });
    });

    it('should handle empty string keys', () => {
      const success = setItem('', 'value', 'local');
      expect(success).toBe(true);

      const retrieved = getItem<string>('', 'local');
      expect(retrieved).toBe('value');
    });

    it('should handle empty string values', () => {
      const success = setItem('key', '', 'local');
      expect(success).toBe(true);

      const retrieved = getItem<string>('key', 'local');
      expect(retrieved).toBe('');
    });

    it('should handle rapid successive operations', () => {
      for (let i = 0; i < 100; i++) {
        setItem(`key${i}`, `value${i}`, 'local');
      }

      for (let i = 0; i < 100; i++) {
        const value = getItem<string>(`key${i}`, 'local');
        expect(value).toBe(`value${i}`);
      }
    });

    it('should handle concurrent getItem calls for same key', () => {
      setItem('concurrent', 'value', 'local');

      const results = Promise.all([
        Promise.resolve(getItem<string>('concurrent', 'local')),
        Promise.resolve(getItem<string>('concurrent', 'local')),
        Promise.resolve(getItem<string>('concurrent', 'local')),
      ]);

      return results.then((values) => {
        values.forEach((value) => {
          expect(value).toBe('value');
        });
      });
    });
  });
});
