/**
 * User Filters Hook
 *
 * Custom React hook providing comprehensive user filtering and search functionality
 * for admin user management. Manages filter state including username, email, role,
 * status (active/suspended/deleted), confirmed status, authentication method, and
 * search queries with debouncing to optimize API performance.
 *
 * Based on Moodle admin user filtering functionality:
 * - Source: public/admin/user.php (user filtering UI and logic)
 * - Source: public/admin/user/lib.php (user_filtering class and helper functions)
 *
 * Features:
 * - Multi-field filtering with independent filter states
 * - Debounced search query to prevent excessive API calls
 * - Predefined status filters (all, active, suspended, deleted, unconfirmed)
 * - Role-based filtering with support for role ID or shortname
 * - Authentication method filtering (manual, LDAP, OAuth, SAML, etc.)
 * - Individual status flags (confirmed, suspended, deleted)
 * - Reset functionality to clear all filters
 * - Type-safe filter object construction with useMemo optimization
 *
 * @package react-frontend
 * @subpackage features/admin/users/hooks
 */

import { useState, useMemo } from 'react';
import useDebounce from '@/hooks/useDebounce';
import type { UserListQueryParams } from '../types/user-list.types';
import { UserFilterStatus } from '../types/user-list.types';

/**
 * Return type for the useUserFilters hook
 *
 * Provides the computed filter object and all setter functions for managing
 * individual filter parameters and debounced search state.
 */
export interface UseUserFiltersReturn {
  /** Computed filter object ready for API query parameters */
  filters: Partial<UserListQueryParams>;
  /** Debounced search query (updates after 500ms of no typing) */
  debouncedSearch: string;
  /** Set the search query (debounced before applying to filters) */
  setSearch: (search: string) => void;
  /** Set the role filter (role ID or shortname) */
  setRole: (role: string | number | undefined) => void;
  /** Set the predefined status filter (overrides individual status flags) */
  setStatus: (status: UserFilterStatus | undefined) => void;
  /** Set the authentication method filter */
  setAuthMethod: (authMethod: string | undefined) => void;
  /** Set the email confirmation status filter (0=unconfirmed, 1=confirmed) */
  setConfirmed: (confirmed: number | undefined) => void;
  /** Set the suspension status filter (0=not suspended, 1=suspended) */
  setSuspended: (suspended: number | undefined) => void;
  /** Set the deletion status filter (0=not deleted, 1=deleted) */
  setDeleted: (deleted: number | undefined) => void;
  /** Reset all filters to their initial empty state */
  resetFilters: () => void;
}

/**
 * User Filters Hook
 *
 * Manages all filter state for the admin user list, providing independent state
 * for each filter parameter and a computed filter object for API queries.
 *
 * @returns {UseUserFiltersReturn} Object containing filters and setter functions
 *
 * @example
 * // Basic usage in a user list component
 * function UserListPage() {
 *   const {
 *     filters,
 *     debouncedSearch,
 *     setSearch,
 *     setRole,
 *     setStatus,
 *     resetFilters
 *   } = useUserFilters();
 *
 *   // Pass filters to React Query
 *   const { data, isLoading } = useUsers(filters);
 *
 *   return (
 *     <div>
 *       <SearchInput value={debouncedSearch} onChange={setSearch} />
 *       <RoleFilter value={filters.role} onChange={setRole} />
 *       <StatusFilter value={filters.status} onChange={setStatus} />
 *       <Button onClick={resetFilters}>Clear Filters</Button>
 *       <UserTable users={data?.users} loading={isLoading} />
 *     </div>
 *   );
 * }
 *
 * @example
 * // Advanced usage with all filter options
 * function AdvancedUserFilters() {
 *   const {
 *     filters,
 *     setSearch,
 *     setRole,
 *     setStatus,
 *     setAuthMethod,
 *     setConfirmed,
 *     setSuspended,
 *     setDeleted,
 *     resetFilters
 *   } = useUserFilters();
 *
 *   return (
 *     <FilterPanel>
 *       <SearchField onChange={(e) => setSearch(e.target.value)} />
 *       <Select label="Role" onChange={(e) => setRole(e.target.value)}>
 *         <option value="">All Roles</option>
 *         <option value="student">Student</option>
 *         <option value="teacher">Teacher</option>
 *       </Select>
 *       <Select label="Status" onChange={(e) => setStatus(e.target.value)}>
 *         <option value="all">All Users</option>
 *         <option value="active">Active Only</option>
 *         <option value="suspended">Suspended Only</option>
 *       </Select>
 *       <Select label="Auth Method" onChange={(e) => setAuthMethod(e.target.value)}>
 *         <option value="">All Methods</option>
 *         <option value="manual">Manual</option>
 *         <option value="ldap">LDAP</option>
 *       </Select>
 *       <Checkbox
 *         label="Show only confirmed users"
 *         onChange={(e) => setConfirmed(e.target.checked ? 1 : undefined)}
 *       />
 *       <Button onClick={resetFilters}>Reset All Filters</Button>
 *     </FilterPanel>
 *   );
 * }
 *
 * Performance Benefits:
 * - Debounced search prevents excessive API calls during typing (500ms delay)
 * - useMemo optimization ensures filters object only recomputes when values change
 * - Individual filter states allow granular updates without affecting others
 * - Reset function efficiently clears all filters in one operation
 *
 * Filter Behavior:
 * - Search query is debounced by 500ms before being applied to filters
 * - Status filter (UserFilterStatus enum) overrides individual status flags on server
 * - Individual status flags (confirmed, suspended, deleted) provide fine-grained control
 * - Role filter accepts both role ID (number) and role shortname (string)
 * - Auth method filter matches against authentication plugin names
 * - All filters are optional - omitted filters apply no constraints
 *
 * Type Safety:
 * - All filter parameters are strictly typed with TypeScript interfaces
 * - Filter object conforms to UserListQueryParams interface for API compatibility
 * - Setter functions enforce correct types for each filter parameter
 * - No 'any' types used - full type inference throughout
 */
export function useUserFilters(): UseUserFiltersReturn {
  // Search query state (debounced separately to avoid excessive API calls)
  const [search, setSearch] = useState<string>('');

  // Role filter state (role ID or shortname)
  const [role, setRole] = useState<string | number | undefined>(undefined);

  // Predefined status filter (overrides individual status flags when set)
  const [status, setStatus] = useState<UserFilterStatus | undefined>(undefined);

  // Authentication method filter (plugin name: 'manual', 'ldap', 'oauth2', etc.)
  const [authMethod, setAuthMethod] = useState<string | undefined>(undefined);

  // Individual status flag filters for fine-grained control
  const [confirmed, setConfirmed] = useState<number | undefined>(undefined);
  const [suspended, setSuspended] = useState<number | undefined>(undefined);
  const [deleted, setDeleted] = useState<number | undefined>(undefined);

  // Debounce search query with 500ms delay to prevent excessive API calls
  // This ensures we only query the API after the user has stopped typing
  const debouncedSearch = useDebounce(search, 500);

  /**
   * Compute the final filter object from individual filter states
   *
   * Uses useMemo to optimize performance by only recomputing when filter values change.
   * The resulting object conforms to UserListQueryParams interface and is ready to be
   * passed directly to the user list API query.
   *
   * Dependencies include debouncedSearch (not raw search) to ensure API calls only
   * happen after the debounce delay, and all individual filter states.
   */
  const filters = useMemo<Partial<UserListQueryParams>>(() => {
    const filterObject: Partial<UserListQueryParams> = {};

    // Add search query if present (already debounced)
    if (debouncedSearch && debouncedSearch.trim().length > 0) {
      filterObject.search = debouncedSearch.trim();
    }

    // Add role filter if set
    if (role !== undefined && role !== '') {
      filterObject.role = role;
    }

    // Add predefined status filter if set
    // Note: Status filter typically overrides individual status flags on the server
    if (status !== undefined && status !== UserFilterStatus.ALL) {
      filterObject.status = status;
    }

    // Add authentication method filter if set
    if (authMethod !== undefined && authMethod !== '') {
      filterObject.authMethod = authMethod;
    }

    // Add individual status flags if set
    // These provide fine-grained control when status filter is not used
    if (confirmed !== undefined) {
      filterObject.confirmed = confirmed;
    }

    if (suspended !== undefined) {
      filterObject.suspended = suspended;
    }

    if (deleted !== undefined) {
      filterObject.deleted = deleted;
    }

    return filterObject;
  }, [debouncedSearch, role, status, authMethod, confirmed, suspended, deleted]);

  /**
   * Reset all filters to their initial empty state
   *
   * Clears all filter parameters in one operation, returning the UI and API
   * queries to their default unfiltered state. Useful for "Clear All" buttons
   * or resetting the view to show all users.
   */
  const resetFilters = (): void => {
    setSearch('');
    setRole(undefined);
    setStatus(undefined);
    setAuthMethod(undefined);
    setConfirmed(undefined);
    setSuspended(undefined);
    setDeleted(undefined);
  };

  // Return computed filters and all management functions
  return {
    filters,
    debouncedSearch,
    setSearch,
    setRole,
    setStatus,
    setAuthMethod,
    setConfirmed,
    setSuspended,
    setDeleted,
    resetFilters,
  };
}

/**
 * Default export for convenient importing
 */
export default useUserFilters;
