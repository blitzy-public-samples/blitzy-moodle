import { useState, useEffect } from 'react';

/**
 * Custom React hook that debounces a rapidly changing value.
 *
 * This hook delays updating the returned value until after a specified delay period
 * has passed without any new changes to the input value. This is useful for optimizing
 * expensive operations that would otherwise be triggered too frequently by rapid user input.
 *
 * @template T - The type of the value to debounce
 * @param {T} value - The value to debounce (can be any type: string, number, object, array, etc.)
 * @param {number} [delay=500] - The delay in milliseconds before updating the debounced value (default: 500ms)
 * @returns {T} The debounced value that only updates after the delay period with no changes
 *
 * @example
 * // Search input - debounce search term before making API call
 * function SearchComponent() {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const debouncedSearchTerm = useDebounce(searchTerm, 800);
 *
 *   useEffect(() => {
 *     if (debouncedSearchTerm) {
 *       // Only make API call after user stops typing for 800ms
 *       searchApi(debouncedSearchTerm);
 *     }
 *   }, [debouncedSearchTerm]);
 *
 *   return (
 *     <input
 *       value={searchTerm}
 *       onChange={(e) => setSearchTerm(e.target.value)}
 *       placeholder="Search..."
 *     />
 *   );
 * }
 *
 * @example
 * // Autocomplete - delay API requests until user stops typing
 * function AutocompleteInput() {
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, 300);
 *
 *   const { data: suggestions } = useQuery({
 *     queryKey: ['autocomplete', debouncedQuery],
 *     queryFn: () => fetchSuggestions(debouncedQuery),
 *     enabled: debouncedQuery.length > 2
 *   });
 *
 *   return <input onChange={(e) => setQuery(e.target.value)} />;
 * }
 *
 * @example
 * // Form validation - validate after user pauses typing
 * function ValidatedInput() {
 *   const [email, setEmail] = useState('');
 *   const debouncedEmail = useDebounce(email, 500);
 *
 *   useEffect(() => {
 *     // Only validate after user stops typing for 500ms
 *     if (debouncedEmail) {
 *       validateEmail(debouncedEmail);
 *     }
 *   }, [debouncedEmail]);
 *
 *   return <input type="email" onChange={(e) => setEmail(e.target.value)} />;
 * }
 *
 * @example
 * // Filter controls - debounce filter changes before re-filtering data
 * function FilteredList() {
 *   const [filters, setFilters] = useState({ category: '', minPrice: 0 });
 *   const debouncedFilters = useDebounce(filters, 400);
 *
 *   const filteredItems = useMemo(() => {
 *     return applyFilters(items, debouncedFilters);
 *   }, [items, debouncedFilters]);
 *
 *   return <div>...</div>;
 * }
 *
 * @example
 * // Resize handler - debounce window resize events
 * function ResponsiveComponent() {
 *   const [windowSize, setWindowSize] = useState({
 *     width: window.innerWidth,
 *     height: window.innerHeight
 *   });
 *   const debouncedSize = useDebounce(windowSize, 150);
 *
 *   useEffect(() => {
 *     const handleResize = () => {
 *       setWindowSize({ width: window.innerWidth, height: window.innerHeight });
 *     };
 *     window.addEventListener('resize', handleResize);
 *     return () => window.removeEventListener('resize', handleResize);
 *   }, []);
 *
 *   // Only recalculate layout after resize stops for 150ms
 *   useEffect(() => {
 *     recalculateLayout(debouncedSize);
 *   }, [debouncedSize]);
 *
 *   return <div>...</div>;
 * }
 *
 * Performance Benefits:
 * - Reduces excessive API calls from rapid input changes (e.g., search-as-you-type)
 * - Prevents unnecessary component re-renders from frequently changing state
 * - Improves user experience by not blocking the UI thread
 * - Saves server resources and bandwidth by batching requests
 * - Optimizes expensive computations (filtering, sorting, validation)
 *
 * Common Use Cases:
 * - Search boxes: debounce search term to reduce API calls
 * - Autocomplete fields: delay API requests until user stops typing
 * - Form validation: validate fields after user pauses typing
 * - Filter controls: debounce filter changes before re-filtering large datasets
 * - Resize handlers: debounce window resize events to prevent excessive recalculations
 * - Scroll handlers: debounce scroll position updates for performance
 * - Text editor auto-save: debounce save operations to reduce server load
 *
 * Implementation Details:
 * - Uses useState to maintain the debounced value state
 * - Uses useEffect with [value, delay] dependencies to track changes
 * - Creates a new timeout each time the value or delay changes
 * - Clears the previous timeout when value changes before delay expires
 * - Automatically cleans up timeout on component unmount to prevent memory leaks
 * - Generic type parameter T supports any value type with full TypeScript type safety
 * - Configurable delay parameter with sensible default (500ms)
 *
 * TypeScript Type Safety:
 * - Generic type parameter preserves the exact type of the input value
 * - No type casting or 'any' types used
 * - Works with primitive types (string, number, boolean)
 * - Works with complex types (objects, arrays, tuples)
 * - Full IntelliSense support in IDEs
 */
function useDebounce<T>(value: T, delay: number = 500): T {
  // Initialize state with the input value
  // The debounced value starts as the initial value and will be updated after the delay
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timeout to update the debounced value after the specified delay
    // This timeout will be cleared if the value changes before the delay expires
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function that runs:
    // 1. Before the effect runs again (when value or delay changes)
    // 2. When the component unmounts
    // This prevents memory leaks and ensures only the latest timeout is active
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Re-run effect when value or delay changes

  // Return the debounced value
  // This value will only update after the delay period passes without any changes to the input value
  return debouncedValue;
}

export default useDebounce;
