import { useState, useEffect, useCallback } from 'react';

/**
 * Return type for the useLocalStorage hook
 * 
 * @template T - The type of the stored value
 */
export type UseLocalStorageReturn<T> = [
  /** The current value stored in localStorage */
  value: T,
  /** Function to update the stored value */
  setValue: (value: T | ((prev: T) => T)) => void,
  /** Function to remove the value from localStorage */
  removeValue: () => void
];

/**
 * Custom React hook for persisting state to browser localStorage with automatic synchronization.
 * 
 * This hook provides a stateful value that is automatically synchronized with localStorage,
 * enabling state persistence across page refreshes and browser sessions. It handles JSON
 * serialization/deserialization, error recovery, and multi-tab synchronization via storage events.
 * 
 * **Key Features:**
 * - Type-safe storage with TypeScript generics
 * - Automatic JSON serialization/deserialization
 * - Multi-tab synchronization via storage events
 * - SSR/SSG compatible (returns initial value on server)
 * - Comprehensive error handling for quota exceeded and invalid JSON
 * - Supports complex objects and arrays
 * - Lazy initialization for optimal performance
 * 
 * **Usage Examples:**
 * 
 * ```typescript
 * // Simple string value
 * const [name, setName, removeName] = useLocalStorage('username', 'Guest');
 * 
 * // Complex object
 * const [user, setUser, removeUser] = useLocalStorage('user', {
 *   id: 0,
 *   email: '',
 *   preferences: {}
 * });
 * 
 * // Array of items
 * const [items, setItems, removeItems] = useLocalStorage<string[]>('cart', []);
 * 
 * // Using updater function (like useState)
 * setItems(prev => [...prev, 'new-item']);
 * 
 * // Removing value
 * removeItems(); // Resets to initial value and removes from localStorage
 * ```
 * 
 * **Multi-tab Synchronization:**
 * When a value is updated in one browser tab, all other tabs with the same hook
 * will automatically synchronize to the new value via the storage event listener.
 * 
 * **Error Handling:**
 * - Returns initial value if localStorage is unavailable (private browsing)
 * - Handles QuotaExceededError gracefully when storage is full
 * - Recovers from invalid JSON by falling back to initial value
 * - Logs errors to console for debugging without breaking the application
 * 
 * @template T - The type of the value to store (must be JSON-serializable)
 * @param key - The localStorage key to use for storage
 * @param initialValue - The default value to use if no stored value exists
 * @returns A tuple containing [value, setValue, removeValue]
 * 
 * @example
 * ```typescript
 * function ThemeSelector() {
 *   const [theme, setTheme] = useLocalStorage('theme', 'light');
 *   
 *   return (
 *     <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
 *       Current theme: {theme}
 *     </button>
 *   );
 * }
 * ```
 */
export default function useLocalStorage<T>(
  key: string,
  initialValue: T
): UseLocalStorageReturn<T> {
  /**
   * Read value from localStorage with error handling
   * This function is called lazily during state initialization
   * 
   * @returns The stored value or initialValue if not found/invalid
   */
  const readValue = (): T => {
    // Handle Server-Side Rendering (SSR) / Static Site Generation (SSG)
    // localStorage is only available in the browser
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Attempt to read from localStorage
      const item = window.localStorage.getItem(key);
      
      // If value exists, parse it from JSON
      if (item !== null) {
        try {
          return JSON.parse(item) as T;
        } catch (parseError) {
          // Invalid JSON in localStorage - log error and return initial value
          console.error(
            `useLocalStorage: Error parsing JSON for key "${key}":`,
            parseError
          );
          return initialValue;
        }
      }
      
      // No stored value found - return initial value
      return initialValue;
    } catch (error) {
      // localStorage is unavailable (e.g., private browsing mode, permissions)
      console.warn(
        `useLocalStorage: Error reading from localStorage for key "${key}":`,
        error
      );
      return initialValue;
    }
  };

  // Initialize state with lazy initialization to avoid unnecessary reads
  const [storedValue, setStoredValue] = useState<T>(() => readValue());

  /**
   * Update the stored value in both state and localStorage
   * Supports both direct values and updater functions (like useState)
   * 
   * @param value - New value or updater function
   */
  const setValue = useCallback(
    (value: T | ((prev: T) => T)): void => {
      try {
        // Calculate new value - support updater function pattern
        const newValue = value instanceof Function ? value(storedValue) : value;
        
        // Update React state
        setStoredValue(newValue);
        
        // Check if window is available (browser environment)
        if (typeof window !== 'undefined') {
          try {
            // Persist to localStorage
            window.localStorage.setItem(key, JSON.stringify(newValue));
          } catch (storageError) {
            // Handle storage quota exceeded or serialization errors
            if (storageError instanceof Error) {
              if (storageError.name === 'QuotaExceededError') {
                console.error(
                  `useLocalStorage: Storage quota exceeded for key "${key}". ` +
                  'Consider clearing old data or reducing storage usage.'
                );
              } else {
                console.error(
                  `useLocalStorage: Error saving to localStorage for key "${key}":`,
                  storageError
                );
              }
            }
          }
        }
      } catch (error) {
        // Catch any unexpected errors during the update process
        console.error(
          `useLocalStorage: Unexpected error in setValue for key "${key}":`,
          error
        );
      }
    },
    [key, storedValue]
  );

  /**
   * Remove the value from both state and localStorage
   * Resets the state to the initial value
   */
  const removeValue = useCallback((): void => {
    try {
      // Reset state to initial value
      setStoredValue(initialValue);
      
      // Check if window is available (browser environment)
      if (typeof window !== 'undefined') {
        try {
          // Remove from localStorage
          window.localStorage.removeItem(key);
        } catch (storageError) {
          console.error(
            `useLocalStorage: Error removing from localStorage for key "${key}":`,
            storageError
          );
        }
      }
    } catch (error) {
      console.error(
        `useLocalStorage: Unexpected error in removeValue for key "${key}":`,
        error
      );
    }
  }, [key, initialValue]);

  /**
   * Set up storage event listener for multi-tab synchronization
   * When another tab updates the same localStorage key, this tab will synchronize
   */
  useEffect(() => {
    // Only set up listener in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    /**
     * Handle storage events from other browser tabs
     * 
     * @param event - StorageEvent containing key, newValue, and oldValue
     */
    const handleStorageChange = (event: StorageEvent): void => {
      // Check if this is the key we're watching
      if (event.key !== key) {
        return;
      }

      // If value was updated in another tab
      if (event.newValue !== null) {
        try {
          // Parse and update state with new value
          const newValue = JSON.parse(event.newValue) as T;
          setStoredValue(newValue);
        } catch (parseError) {
          // Invalid JSON - ignore this update
          console.warn(
            `useLocalStorage: Error parsing storage event for key "${key}":`,
            parseError
          );
        }
      } else {
        // Value was removed in another tab - reset to initial value
        setStoredValue(initialValue);
      }
    };

    // Register event listener for storage changes
    window.addEventListener('storage', handleStorageChange);

    // Cleanup: remove event listener on unmount or when dependencies change
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  // Return tuple matching useState pattern with additional removeValue function
  return [storedValue, setValue, removeValue];
}
