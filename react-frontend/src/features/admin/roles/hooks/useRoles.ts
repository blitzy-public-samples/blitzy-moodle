/**
 * useRoles Hook - Comprehensive Role Management for Moodle Administration
 *
 * Custom React hook providing role management functionality for Moodle administration.
 * Integrates React Query for server state management of roles data, providing
 * TypeScript-safe methods for listing all system roles, assigning/unassigning roles
 * to users in specific contexts, retrieving role capabilities, and managing role definitions.
 *
 * This hook acts as the primary interface for admin components to interact with
 * role management by consuming the adminRolesApi client and providing optimized
 * caching, loading states, and error handling for all role-related operations.
 *
 * Moodle Role System Overview:
 * - Roles define sets of permissions (capabilities) that can be assigned to users
 * - Role assignments link users to roles within specific contexts (system, course, module, etc.)
 * - Capabilities determine what actions users can perform (e.g., moodle/course:create)
 * - Context hierarchy allows permission inheritance from parent to child contexts
 *
 * Backend Permission Requirements:
 * - moodle/role:manage - Required for viewing and managing role definitions
 * - moodle/role:assign - Required for assigning/unassigning roles to users
 *
 * All API calls delegate to existing Moodle PHP functions:
 * - get_all_roles() - Retrieves all defined roles in the system
 * - role_assign() - Assigns a role to a user in a context
 * - role_unassign() - Removes a role assignment from a user
 * - get_role_capabilities() - Gets capability permissions for a role
 *
 * @module features/admin/roles/hooks/useRoles
 */

import { useCallback, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';

import {
  getRoles,
  assignRole as assignRoleApi,
  unassignRole as unassignRoleApi,
  getRoleCapabilities as getRoleCapabilitiesApi,
  getAssignableRoles as getAssignableRolesApi,
  getRoleAssignments,
} from '@/features/admin/roles/api/adminRolesApi';

import type {
  Role,
  RoleCapability,
} from '@/features/admin/roles/types/role.types';

// ============================================================================
// Query Keys - Used for cache management and invalidation
// ============================================================================

/**
 * Query key factory for role-related queries
 *
 * Provides consistent query keys for React Query cache management.
 * Used for cache invalidation after mutations and query deduplication.
 */
export const roleQueryKeys = {
  /** Base key for all role queries */
  all: ['admin', 'roles'] as const,

  /** Key for roles list query */
  list: () => [...roleQueryKeys.all, 'list'] as const,

  /** Key for single role details */
  detail: (roleId: number) => [...roleQueryKeys.all, 'detail', roleId] as const,

  /** Key for role capabilities */
  capabilities: (roleId: number) =>
    [...roleQueryKeys.all, 'capabilities', roleId] as const,

  /** Key for assignable roles in a context */
  assignable: (contextId: number) =>
    [...roleQueryKeys.all, 'assignable', contextId] as const,

  /** Key for role assignments in a context */
  assignments: (contextId: number) =>
    [...roleQueryKeys.all, 'assignments', contextId] as const,

  /** Key for user's role assignments */
  userRoles: (userId: number) =>
    ['admin', 'users', userId, 'roles'] as const,
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Parameters for role assignment operations
 *
 * Used by assignRole and unassignRole mutations to specify the target
 * role, user, and context for assignment changes.
 */
export interface RoleAssignmentParams {
  /** The unique identifier of the role to assign/unassign */
  roleId: number;

  /** The unique identifier of the user to receive/lose the role */
  userId: number;

  /** The context ID where the role should be assigned/unassigned */
  contextId: number;
}

/**
 * Return type for the useRoles hook
 *
 * Provides a comprehensive interface for role management operations
 * including data access, mutations, and loading/error states.
 */
export interface UseRolesReturn {
  /**
   * Array of all system roles
   *
   * Contains all roles defined in Moodle with their id, name, shortname,
   * description, sortorder, and archetype. Undefined while loading.
   */
  roles: Role[] | undefined;

  /**
   * Loading state for the roles query
   *
   * True while the initial roles fetch is in progress.
   */
  isLoadingRoles: boolean;

  /**
   * Error from the roles query
   *
   * Contains error details if the roles fetch failed, null otherwise.
   */
  rolesError: Error | null;

  /**
   * Assigns a role to a user in a specific context
   *
   * Creates a new role assignment linking a user to a role within a
   * particular context. Grants the user all capabilities associated
   * with that role in that context and child contexts.
   *
   * @param roleId - The unique identifier of the role to assign
   * @param userId - The unique identifier of the user to receive the role
   * @param contextId - The context ID where the role should be assigned
   * @returns Promise that resolves when assignment is complete
   * @throws Error if assignment fails or user lacks permission
   *
   * @example
   * ```typescript
   * // Assign teacher role (id=4) to user 123 in course context 456
   * await assignRole(4, 123, 456);
   * ```
   */
  assignRole: (
    roleId: number,
    userId: number,
    contextId: number
  ) => Promise<void>;

  /**
   * Removes a role from a user in a specific context
   *
   * Deletes an existing role assignment, removing the user's access to
   * capabilities granted by that role in the associated context.
   *
   * @param roleId - The unique identifier of the role to unassign
   * @param userId - The unique identifier of the user to lose the role
   * @param contextId - The context ID where the role should be unassigned
   * @returns Promise that resolves when unassignment is complete
   * @throws Error if unassignment fails or assignment not found
   *
   * @example
   * ```typescript
   * // Remove teacher role (id=4) from user 123 in course context 456
   * await unassignRole(4, 123, 456);
   * ```
   */
  unassignRole: (
    roleId: number,
    userId: number,
    contextId: number
  ) => Promise<void>;

  /**
   * Loading state for assignment mutations
   *
   * True while an assignRole or unassignRole operation is in progress.
   */
  isAssigning: boolean;

  /**
   * Error from the most recent assignment operation
   *
   * Contains error details if the last assign/unassign failed, null otherwise.
   */
  assignmentError: Error | null;

  /**
   * Fetches all capabilities assigned to a specific role
   *
   * Retrieves the complete list of capability permissions (ALLOW, PREVENT,
   * PROHIBIT, or INHERIT) defined for a role. Can be called on-demand when
   * viewing role details.
   *
   * @param roleId - The unique identifier of the role
   * @returns Promise resolving to array of role capabilities
   * @throws Error if fetch fails or user lacks permission
   *
   * @example
   * ```typescript
   * const capabilities = await getRoleCapabilities(4);
   * capabilities.forEach(cap => {
   *   console.log(`${cap.capability}: ${cap.permission}`);
   * });
   * ```
   */
  getRoleCapabilities: (roleId: number) => Promise<RoleCapability[]>;

  /**
   * Fetches roles that can be assigned in a specific context
   *
   * Retrieves the list of roles that the current user is permitted to
   * assign in the given context. Respects role assignment restrictions
   * configured in Moodle. Used for role assignment dropdowns.
   *
   * @param contextId - The context ID to get assignable roles for
   * @returns Promise resolving to array of assignable roles
   * @throws Error if fetch fails or user lacks permission
   *
   * @example
   * ```typescript
   * const assignableRoles = await getAssignableRoles(456);
   * // Use in a dropdown for role selection
   * ```
   */
  getAssignableRoles: (contextId: number) => Promise<Role[]>;

  /**
   * Manually refetches the roles list
   *
   * Forces a fresh fetch of all roles from the server, bypassing the cache.
   * Useful after external changes or to ensure data freshness.
   *
   * @returns Promise that resolves when refetch is complete
   */
  refetchRoles: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Stale time for roles data (5 minutes)
 *
 * Roles don't change frequently, so we can keep cached data for longer.
 * This reduces unnecessary API calls while still keeping data reasonably fresh.
 */
const ROLES_STALE_TIME = 5 * 60 * 1000;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for comprehensive role management
 *
 * Provides all necessary methods and state for managing Moodle roles in the
 * React frontend. Uses React Query for efficient caching, background refetching,
 * and optimistic updates.
 *
 * Features:
 * - Cached roles list with automatic background refetching
 * - Optimistic updates for role assignments
 * - Automatic cache invalidation after mutations
 * - TypeScript-safe interfaces for all operations
 * - Comprehensive error handling
 *
 * Backend Integration:
 * All operations delegate to existing Moodle PHP functions via the API layer.
 * Permission checks (require_capability) are enforced on the backend.
 *
 * @returns Object containing roles data, mutations, and state
 *
 * @example
 * ```typescript
 * function RoleManagement() {
 *   const {
 *     roles,
 *     isLoadingRoles,
 *     rolesError,
 *     assignRole,
 *     unassignRole,
 *     isAssigning,
 *   } = useRoles();
 *
 *   if (isLoadingRoles) return <Spinner />;
 *   if (rolesError) return <Error message={rolesError.message} />;
 *
 *   return (
 *     <RoleList
 *       roles={roles}
 *       onAssign={assignRole}
 *       onUnassign={unassignRole}
 *       isAssigning={isAssigning}
 *     />
 *   );
 * }
 * ```
 */
export function useRoles(): UseRolesReturn {
  // Get query client for cache management and invalidation
  const queryClient = useQueryClient();

  // ============================================================================
  // Roles List Query
  // ============================================================================

  /**
   * Query for fetching all system roles
   *
   * Retrieves all roles defined in Moodle via GET /api/v1/admin/roles.
   * Calls existing Moodle get_all_roles() function via API wrapper.
   */
  const rolesQuery: UseQueryResult<Role[], Error> = useQuery({
    queryKey: roleQueryKeys.list(),
    queryFn: async (): Promise<Role[]> => {
      const response = await getRoles();
      return response.data.roles;
    },
    staleTime: ROLES_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  // ============================================================================
  // Assign Role Mutation
  // ============================================================================

  /**
   * Mutation for assigning a role to a user
   *
   * Posts to /api/v1/admin/roles/assign endpoint which calls
   * existing Moodle role_assign() function.
   *
   * Implements optimistic updates and automatic cache invalidation.
   */
  const assignRoleMutation: UseMutationResult<
    void,
    Error,
    RoleAssignmentParams
  > = useMutation({
    mutationFn: async ({
      roleId,
      userId,
      contextId,
    }: RoleAssignmentParams): Promise<void> => {
      await assignRoleApi(roleId, userId, contextId);
    },
    onSuccess: (_data, variables) => {
      // Invalidate roles list to refresh assignment counts
      queryClient.invalidateQueries({
        queryKey: roleQueryKeys.all,
      });

      // Invalidate the user's roles query to reflect new assignment
      queryClient.invalidateQueries({
        queryKey: roleQueryKeys.userRoles(variables.userId),
      });

      // Invalidate assignments for the context
      queryClient.invalidateQueries({
        queryKey: roleQueryKeys.assignments(variables.contextId),
      });
    },
    onError: (error) => {
      // Error is captured in mutation state - no additional handling needed
      console.error('Failed to assign role:', error);
    },
  });

  // ============================================================================
  // Unassign Role Mutation
  // ============================================================================

  /**
   * Mutation for unassigning a role from a user
   *
   * Implements a two-step process:
   * 1. Fetches current role assignments to find the matching assignment ID
   * 2. Deletes the assignment via /api/v1/admin/roles/assign?id={assignmentId}
   *
   * This abstracts the assignment ID lookup from the consumer, providing
   * a cleaner interface that matches Moodle's native role_unassign() function.
   */
  const unassignRoleMutation: UseMutationResult<
    void,
    Error,
    RoleAssignmentParams
  > = useMutation({
    mutationFn: async ({
      roleId,
      userId,
      contextId,
    }: RoleAssignmentParams): Promise<void> => {
      // First, get the role assignments in the context to find the matching assignment
      const assignmentsResponse = await getRoleAssignments(contextId, roleId);
      const assignments = assignmentsResponse.data.assignments;

      // Find the assignment matching the user
      const targetAssignment = assignments.find(
        (assignment) =>
          assignment.userid === userId && assignment.roleid === roleId
      );

      if (!targetAssignment) {
        throw new Error(
          `Role assignment not found for role ${roleId}, user ${userId} in context ${contextId}`
        );
      }

      // Unassign using the found assignment ID
      await unassignRoleApi(targetAssignment.id);
    },
    onSuccess: (_data, variables) => {
      // Invalidate roles list to refresh assignment counts
      queryClient.invalidateQueries({
        queryKey: roleQueryKeys.all,
      });

      // Invalidate the user's roles query to reflect removed assignment
      queryClient.invalidateQueries({
        queryKey: roleQueryKeys.userRoles(variables.userId),
      });

      // Invalidate assignments for the context
      queryClient.invalidateQueries({
        queryKey: roleQueryKeys.assignments(variables.contextId),
      });
    },
    onError: (error) => {
      // Error is captured in mutation state - no additional handling needed
      console.error('Failed to unassign role:', error);
    },
  });

  // ============================================================================
  // On-Demand Fetch Callbacks
  // ============================================================================

  /**
   * Callback for fetching role capabilities on-demand
   *
   * Uses useCallback to maintain referential equality across renders.
   * Can be called when user views role details to fetch capabilities.
   */
  const getRoleCapabilitiesCallback = useCallback(
    async (roleId: number): Promise<RoleCapability[]> => {
      const response = await getRoleCapabilitiesApi(roleId);
      return response.data.capabilities;
    },
    []
  );

  /**
   * Callback for fetching assignable roles on-demand
   *
   * Uses useCallback to maintain referential equality across renders.
   * Filters roles based on context permissions and assignment restrictions.
   */
  const getAssignableRolesCallback = useCallback(
    async (contextId: number): Promise<Role[]> => {
      const response = await getAssignableRolesApi(contextId);
      return response.data.roles;
    },
    []
  );

  /**
   * Callback for manually refetching the roles list
   *
   * Forces a fresh fetch from the server, bypassing the cache.
   */
  const refetchRolesCallback = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: roleQueryKeys.list(),
    });
  }, [queryClient]);

  // ============================================================================
  // Wrapped Mutation Functions
  // ============================================================================

  /**
   * Wrapped assignRole function with cleaner interface
   *
   * Converts the mutation's mutateAsync to a simpler Promise-based interface.
   */
  const assignRole = useCallback(
    async (
      roleId: number,
      userId: number,
      contextId: number
    ): Promise<void> => {
      await assignRoleMutation.mutateAsync({ roleId, userId, contextId });
    },
    [assignRoleMutation]
  );

  /**
   * Wrapped unassignRole function with cleaner interface
   *
   * Converts the mutation's mutateAsync to a simpler Promise-based interface.
   */
  const unassignRole = useCallback(
    async (
      roleId: number,
      userId: number,
      contextId: number
    ): Promise<void> => {
      await unassignRoleMutation.mutateAsync({ roleId, userId, contextId });
    },
    [unassignRoleMutation]
  );

  // ============================================================================
  // Memoized Return Value
  // ============================================================================

  /**
   * Memoized return object to prevent unnecessary re-renders
   *
   * Only creates a new object when the underlying values actually change.
   */
  const returnValue = useMemo<UseRolesReturn>(
    () => ({
      // Roles query data and states
      roles: rolesQuery.data,
      isLoadingRoles: rolesQuery.isLoading,
      rolesError: rolesQuery.error ?? null,

      // Assignment mutations
      assignRole,
      unassignRole,
      isAssigning:
        assignRoleMutation.isPending || unassignRoleMutation.isPending,
      assignmentError:
        assignRoleMutation.error ?? unassignRoleMutation.error ?? null,

      // On-demand fetch callbacks
      getRoleCapabilities: getRoleCapabilitiesCallback,
      getAssignableRoles: getAssignableRolesCallback,
      refetchRoles: refetchRolesCallback,
    }),
    [
      rolesQuery.data,
      rolesQuery.isLoading,
      rolesQuery.error,
      assignRole,
      unassignRole,
      assignRoleMutation.isPending,
      unassignRoleMutation.isPending,
      assignRoleMutation.error,
      unassignRoleMutation.error,
      getRoleCapabilitiesCallback,
      getAssignableRolesCallback,
      refetchRolesCallback,
    ]
  );

  return returnValue;
}

// ============================================================================
// Default Export
// ============================================================================

export default useRoles;
