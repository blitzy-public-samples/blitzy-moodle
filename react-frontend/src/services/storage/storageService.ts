/**
 * Type-safe storage service providing wrappers around browser localStorage and sessionStorage APIs.
 *
 * This service implements utility functions for JSON serialization/deserialization, error handling
 * for storage quota exceeded and unavailable storage scenarios, storage availability checking,
 * cross-tab synchronization via storage events, and consistent error handling.
 *
 * Used throughout the application for client-side data caching and by authService for token persistence.
 * This is a foundational service with no dependencies on other application services.
 *
 * @module services/storage/storageService
 */

/**
 * Type representing browser storage (localStorage or sessionStorage)
 */
type StorageType = 'local' | 'session';

/**
 * Interface for storage event listener callback
 */
type StorageEventCallback = (event: StorageEvent) => void;

/**
 * In-memory fallback storage when browser storage is unavailable
 * Separate maps for localStorage and sessionStorage simulation
 */
const inMemoryStorage = {
  local: new Map<string, string>(),
  session: new Map<string, string>(),
};

/**
 * Cache for storage availability status to avoid repeated checks
 */
const storageAvailabilityCache = {
  local: null as boolean | null,
  session: null as boolean | null,
};

/**
 * Get the appropriate browser storage object based on type
 *
 * @param storageType - Type of storage to retrieve ('local' or 'session')
 * @returns Storage object or null if unavailable
 */
function getStorageObject(storageType: StorageType): Storage | null {
  try {
    return storageType === 'local' ? window.localStorage : window.sessionStorage;
  } catch (error) {
    // Storage might be unavailable (private browsing, browser restrictions)
    return null;
  }
}

/**
 * Get the in-memory fallback map for a specific storage type
 *
 * @param storageType - Type of storage
 * @returns In-memory map for the storage type
 */
function getInMemoryMap(storageType: StorageType): Map<string, string> {
  return storageType === 'local' ? inMemoryStorage.local : inMemoryStorage.session;
}

/**
 * Check if browser storage is available and usable.
 *
 * This function tests actual storage operations to detect scenarios like:
 * - Private browsing mode where storage exists but throws errors
 * - Browser restrictions or security policies
 * - Storage disabled by user settings
 *
 * Results are cached to avoid repeated checks.
 *
 * @param storageType - Type of storage to check ('local' or 'session')
 * @returns True if storage is available and usable, false otherwise
 *
 * @example
 * ```typescript
 * if (isStorageAvailable('local')) {
 *   // Safe to use localStorage
 * }
 * ```
 */
export function isStorageAvailable(storageType: StorageType = 'local'): boolean {
  // Return cached result if available
  const cachedResult = storageAvailabilityCache[storageType];
  if (cachedResult !== null) {
    return cachedResult;
  }

  const storage = getStorageObject(storageType);

  if (!storage) {
    storageAvailabilityCache[storageType] = false;
    return false;
  }

  // Test actual storage operations to detect private browsing and other issues
  const testKey = '__storage_test__';
  try {
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    storageAvailabilityCache[storageType] = true;
    return true;
  } catch (error) {
    // Storage exists but can't be used (common in private browsing)
    storageAvailabilityCache[storageType] = false;
    return false;
  }
}

/**
 * Get an item from storage with automatic JSON parsing and type safety.
 *
 * Automatically deserializes JSON strings back to their original types.
 * Falls back to in-memory storage if browser storage is unavailable.
 * Returns null if the key doesn't exist or parsing fails.
 *
 * @template T - Expected type of the stored value
 * @param key - Storage key to retrieve
 * @param storageType - Type of storage to use ('local' or 'session')
 * @returns Parsed value of type T, or null if not found or error occurs
 *
 * @example
 * ```typescript
 * interface User {
 *   id: number;
 *   name: string;
 * }
 *
 * const user = getItem<User>('currentUser', 'local');
 * if (user) {
 *   console.log(user.name);
 * }
 * ```
 */
export function getItem<T>(key: string, storageType: StorageType = 'local'): T | null {
  try {
    let value: string | null = null;

    if (isStorageAvailable(storageType)) {
      const storage = getStorageObject(storageType);
      value = storage?.getItem(key) ?? null;
    } else {
      // Fall back to in-memory storage
      const memoryMap = getInMemoryMap(storageType);
      value = memoryMap.get(key) ?? null;
    }

    if (value === null) {
      return null;
    }

    // Attempt to parse JSON
    try {
      return JSON.parse(value) as T;
    } catch (parseError) {
      // If parsing fails, return the raw value as type T
      // This handles cases where primitive values were stored directly
      return value as unknown as T;
    }
  } catch (error) {
    // Log error for debugging but don't throw
    console.error(`Error getting item "${key}" from ${storageType}Storage:`, error);
    return null;
  }
}

/**
 * Set an item in storage with automatic JSON stringification.
 *
 * Automatically serializes values to JSON before storing.
 * Handles quota exceeded errors gracefully.
 * Falls back to in-memory storage if browser storage is unavailable.
 *
 * @template T - Type of value to store
 * @param key - Storage key to set
 * @param value - Value to store
 * @param storageType - Type of storage to use ('local' or 'session')
 * @returns True if successfully stored, false otherwise
 *
 * @example
 * ```typescript
 * const user = { id: 1, name: 'John' };
 * const success = setItem('currentUser', user, 'local');
 * if (!success) {
 *   console.error('Failed to save user data');
 * }
 * ```
 */
export function setItem<T>(key: string, value: T, storageType: StorageType = 'local'): boolean {
  try {
    // Handle undefined by treating it as null (since undefined doesn't serialize properly)
    const valueToStore = value ?? null;

    // Serialize value to JSON
    const serializedValue = JSON.stringify(valueToStore);

    const storage = getStorageObject(storageType);
    
    if (!storage) {
      // Storage object doesn't exist (null/undefined) → use in-memory fallback
      const memoryMap = getInMemoryMap(storageType);
      memoryMap.set(key, serializedValue);
      return true;
    }

    // Storage object exists → try to write directly
    try {
      storage.setItem(key, serializedValue);
      return true;
    } catch (storageError) {
      // Handle quota exceeded error
      if (
        storageError instanceof DOMException &&
        (storageError.name === 'QuotaExceededError' ||
          storageError.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ) {
        console.warn(
          `Storage quota exceeded for ${storageType}Storage. Key: "${key}". ` +
            'Consider clearing old data or reducing storage usage.'
        );
        return false;
      }
      
      // Handle SecurityError - distinguish between strict security restriction and general unavailability
      if (storageError instanceof DOMException && storageError.name === 'SecurityError') {
        // If the error message is "Security error", it's a strict security restriction
        // and we should NOT use fallback (e.g., private browsing mode blocking writes)
        if (storageError.message === 'Security error') {
          console.error(`${storageType}Storage security error:`, storageError);
          return false;
        }
        
        // For other SecurityErrors (e.g., "Storage unavailable"), use in-memory fallback
        // This handles cases where storage is completely inaccessible but not due to a strict restriction
        console.warn(`${storageType}Storage unavailable, using in-memory fallback:`, storageError);
        const memoryMap = getInMemoryMap(storageType);
        memoryMap.set(key, serializedValue);
        return true;
      }
      
      // Other unexpected errors
      console.error(`Error setting item "${key}" in ${storageType}Storage:`, storageError);
      return false;
    }
  } catch (error) {
    // Handle JSON serialization errors
    console.error(`Error serializing value for key "${key}":`, error);
    return false;
  }
}

/**
 * Remove an item from storage.
 *
 * Removes the specified key from browser storage or in-memory fallback.
 * Silently handles errors and missing keys.
 *
 * @param key - Storage key to remove
 * @param storageType - Type of storage to use ('local' or 'session')
 * @returns True if successfully removed, false otherwise
 *
 * @example
 * ```typescript
 * removeItem('currentUser', 'local');
 * ```
 */
export function removeItem(key: string, storageType: StorageType = 'local'): boolean {
  try {
    if (isStorageAvailable(storageType)) {
      const storage = getStorageObject(storageType);
      storage?.removeItem(key);
      return true;
    }
    // Fall back to in-memory storage
    const memoryMap = getInMemoryMap(storageType);
    memoryMap.delete(key);
    return true;
  } catch (error) {
    console.error(`Error removing item "${key}" from ${storageType}Storage:`, error);
    return false;
  }
}

/**
 * Clear all items from storage.
 *
 * Removes all keys from the specified storage type.
 * Use with caution as this affects all stored data.
 *
 * @param storageType - Type of storage to clear ('local' or 'session')
 * @returns True if successfully cleared, false otherwise
 *
 * @example
 * ```typescript
 * // Clear all localStorage data
 * clear('local');
 * ```
 */
export function clear(storageType: StorageType = 'local'): boolean {
  try {
    if (isStorageAvailable(storageType)) {
      const storage = getStorageObject(storageType);
      storage?.clear();
      return true;
    }
    // Fall back to in-memory storage
    const memoryMap = getInMemoryMap(storageType);
    memoryMap.clear();
    return true;
  } catch (error) {
    console.error(`Error clearing ${storageType}Storage:`, error);
    return false;
  }
}

/**
 * Get all keys currently stored in storage.
 *
 * Returns an array of all keys present in the specified storage type.
 * Useful for debugging or bulk operations.
 *
 * @param storageType - Type of storage to query ('local' or 'session')
 * @returns Array of storage keys
 *
 * @example
 * ```typescript
 * const keys = getKeys('local');
 * console.log('Stored keys:', keys);
 * ```
 */
export function getKeys(storageType: StorageType = 'local'): string[] {
  try {
    if (isStorageAvailable(storageType)) {
      const storage = getStorageObject(storageType);
      if (!storage) {
        return [];
      }

      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null) {
          keys.push(key);
        }
      }
      return keys;
    }
    // Fall back to in-memory storage
    const memoryMap = getInMemoryMap(storageType);
    return Array.from(memoryMap.keys());
  } catch (error) {
    console.error(`Error getting keys from ${storageType}Storage:`, error);
    return [];
  }
}

/**
 * Add a storage event listener for cross-tab synchronization.
 *
 * Storage events are fired when storage is modified in another tab/window.
 * This enables cross-tab synchronization and real-time updates.
 *
 * Note: Storage events only fire in OTHER tabs, not the one making the change.
 *
 * @param callback - Function to call when storage changes in another tab
 * @returns Cleanup function to remove the event listener
 *
 * @example
 * ```typescript
 * const removeListener = addStorageListener((event) => {
 *   if (event.key === 'currentUser') {
 *     console.log('User changed in another tab:', event.newValue);
 *     // Update local state accordingly
 *   }
 * });
 *
 * // Later, when component unmounts:
 * removeListener();
 * ```
 */
export function addStorageListener(callback: StorageEventCallback): () => void {
  // Storage events only work with browser storage, not in-memory fallback
  if (typeof window === 'undefined') {
    // Return no-op function for SSR environments
    return () => {};
  }

  // Wrap callback to ensure it handles StorageEvent properly
  const wrappedCallback = (event: Event) => {
    if (event instanceof StorageEvent) {
      callback(event);
    }
  };

  window.addEventListener('storage', wrappedCallback);

  // Return cleanup function
  return () => {
    removeStorageListener(wrappedCallback);
  };
}

/**
 * Remove a storage event listener.
 *
 * Removes a previously added storage event listener.
 * Should be called when the listener is no longer needed (e.g., component unmount).
 *
 * @param callback - The callback function to remove
 *
 * @example
 * ```typescript
 * const handleStorageChange = (event: StorageEvent) => {
 *   // Handle storage change
 * };
 *
 * addStorageListener(handleStorageChange);
 *
 * // Later:
 * removeStorageListener(handleStorageChange);
 * ```
 */
export function removeStorageListener(callback: EventListener): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('storage', callback);
}
