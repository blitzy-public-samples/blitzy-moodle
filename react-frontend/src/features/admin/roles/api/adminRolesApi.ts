/**
 * Admin Roles API Client Module
 *
 * TypeScript API client for role management operations that provides functions
 * to interact with the Moodle roles administration API. This module wraps RESTful
 * API calls to /api/v1/admin/roles/* endpoints using the pre-configured axios client.
 *
 * Features:
 * - Fetch all roles with sorting and filtering
 * - Get individual role details by ID
 * - Manage role assignments to users in specific contexts
 * - Fetch and update role capabilities/permissions
 * - Get assignable roles for a given context
 *
 * All functions use the apiClient from @/services/api/client with proper TypeScript
 * interfaces for request/response types, error handling with try-catch blocks, and
 * consistent API response envelope parsing.
 *
 * Backend Permission Requirements:
 * - moodle/role:manage - Required for viewing and managing roles
 * - moodle/role:assign - Required for assigning/unassigning roles to users
 * - moodle/role:override - Required for modifying capability permissions
 *
 * @module features/admin/roles/api/adminRolesApi
 */

import { apiClient } from '@/services/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  Role,
  RoleAssignment,
  RoleCapability,
  Permission,
} from '@/features/admin/roles/types/role.types';

// ============================================================================
// API Endpoint Constants
// ============================================================================

/**
 * Base path for admin roles API endpoints
 */
const ROLES_API_BASE = '/admin/roles';

/**
 * Roles list/details endpoint
 */
const ROLES_INDEX_ENDPOINT = `${ROLES_API_BASE}/index.php`;

/**
 * Role assignments endpoint
 */
const ROLES_ASSIGN_ENDPOINT = `${ROLES_API_BASE}/assign.php`;

/**
 * Role capabilities endpoint
 */
const ROLES_CAPABILITIES_ENDPOINT = `${ROLES_API_BASE}/capabilities.php`;

// ============================================================================
// Type Definitions for API Responses
// ============================================================================

/**
 * Response data for getRoles endpoint
 */
export interface GetRolesResponse {
  /**
   * Array of all roles in the system
   */
  roles: Role[];

  /**
   * Total count of roles
   */
  total: number;
}

/**
 * Response data for getRoleById endpoint
 */
export interface GetRoleByIdResponse {
  /**
   * The requested role with full details
   */
  role: Role;

  /**
   * Context levels where this role can be assigned
   */
  allowedContextLevels?: number[];

  /**
   * Number of users currently assigned this role
   */
  assignmentCount?: number;
}

/**
 * Response data for getRoleCapabilities endpoint
 */
export interface GetRoleCapabilitiesResponse {
  /**
   * Array of capabilities assigned to the role
   */
  capabilities: RoleCapability[];

  /**
   * The role ID these capabilities belong to
   */
  roleid: number;

  /**
   * Total number of capabilities
   */
  total: number;
}

/**
 * Response data for assignRole endpoint
 */
export interface AssignRoleResponse {
  /**
   * The created role assignment
   */
  assignment: RoleAssignment;

  /**
   * Success message
   */
  message: string;
}

/**
 * Response data for unassignRole endpoint
 */
export interface UnassignRoleResponse {
  /**
   * Success indicator
   */
  removed: boolean;

  /**
   * Success message
   */
  message: string;
}

/**
 * Response data for getRoleAssignments endpoint
 */
export interface GetRoleAssignmentsResponse {
  /**
   * Array of role assignments in the context
   */
  assignments: RoleAssignment[];

  /**
   * The context ID these assignments belong to
   */
  contextid: number;

  /**
   * Total number of assignments
   */
  total: number;
}

/**
 * Response data for updateRoleCapability endpoint
 */
export interface UpdateRoleCapabilityResponse {
  /**
   * The updated capability
   */
  capability: RoleCapability;

  /**
   * Success message
   */
  message: string;
}

/**
 * Response data for getAssignableRoles endpoint
 */
export interface GetAssignableRolesResponse {
  /**
   * Array of roles that can be assigned in the given context
   */
  roles: Role[];

  /**
   * Assignment counts per role in this context
   */
  assignCounts: Record<number, number>;

  /**
   * The context ID these assignable roles apply to
   */
  contextid: number;
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Custom error class for API-specific errors
 *
 * Provides additional context about the failed operation and includes
 * the original error for debugging purposes.
 */
export class AdminRolesApiError extends Error {
  /**
   * HTTP status code if available
   */
  public readonly statusCode?: number;

  /**
   * Error code from the API response
   */
  public readonly errorCode?: string;

  /**
   * Original error that caused this error
   */
  public readonly originalError?: unknown;

  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'AdminRolesApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AdminRolesApiError);
    }
  }
}

/**
 * Extracts error message from various error types
 *
 * @param error - The caught error
 * @param defaultMessage - Default message if extraction fails
 * @returns Extracted error message string
 */
function extractErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return defaultMessage;
}

/**
 * Extracts status code from axios error response
 *
 * @param error - The caught error
 * @returns HTTP status code or undefined
 */
function extractStatusCode(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response: unknown }).response === 'object' &&
    (error as { response: { status?: unknown } }).response !== null
  ) {
    const status = (error as { response: { status?: unknown } }).response.status;
    if (typeof status === 'number') {
      return status;
    }
  }
  return undefined;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches all roles from the system
 *
 * Retrieves a complete list of all roles defined in Moodle with their
 * id, name, shortname, description, sortorder, and archetype.
 *
 * API Endpoint: GET /api/v1/admin/roles/index.php
 *
 * Required Capability: moodle/role:manage
 *
 * @returns Promise resolving to the roles list response
 * @throws AdminRolesApiError if the API call fails
 *
 * @example
 * ```typescript
 * const response = await getRoles();
 * response.data.roles.forEach(role => {
 *   console.log(`${role.name} (${role.shortname})`);
 * });
 * ```
 */
export async function getRoles(): Promise<ApiResponse<GetRolesResponse>> {
  try {
    const response = await apiClient.get<ApiResponse<GetRolesResponse>>(
      ROLES_INDEX_ENDPOINT
    );
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(error, 'Failed to fetch roles');
    const statusCode = extractStatusCode(error);
    throw new AdminRolesApiError(message, statusCode, 'FETCH_ROLES_ERROR', error);
  }
}

/**
 * Fetches a single role by ID with full details
 *
 * Retrieves detailed information about a specific role including its
 * allowed context levels and current assignment count.
 *
 * API Endpoint: GET /api/v1/admin/roles/index.php?roleid={id}
 *
 * Required Capability: moodle/role:manage
 *
 * @param roleId - The unique identifier of the role to fetch
 * @returns Promise resolving to the role details response
 * @throws AdminRolesApiError if the API call fails or role not found
 *
 * @example
 * ```typescript
 * const response = await getRoleById(5);
 * console.log(`Role: ${response.data.role.name}`);
 * console.log(`Assignments: ${response.data.assignmentCount}`);
 * ```
 */
export async function getRoleById(
  roleId: number
): Promise<ApiResponse<GetRoleByIdResponse>> {
  try {
    const response = await apiClient.get<ApiResponse<GetRoleByIdResponse>>(
      ROLES_INDEX_ENDPOINT,
      {
        params: {
          roleid: roleId,
        },
      }
    );
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(
      error,
      `Failed to fetch role with ID ${roleId}`
    );
    const statusCode = extractStatusCode(error);
    throw new AdminRolesApiError(
      message,
      statusCode,
      'FETCH_ROLE_BY_ID_ERROR',
      error
    );
  }
}

/**
 * Fetches all capabilities assigned to a specific role
 *
 * Retrieves the complete list of capability permissions (ALLOW, PREVENT,
 * PROHIBIT, or INHERIT) defined for a role. These capabilities determine
 * what users with this role can do.
 *
 * API Endpoint: GET /api/v1/admin/roles/capabilities.php?roleid={id}
 *
 * Required Capability: moodle/role:manage
 *
 * @param roleId - The unique identifier of the role
 * @returns Promise resolving to the role capabilities response
 * @throws AdminRolesApiError if the API call fails
 *
 * @example
 * ```typescript
 * const response = await getRoleCapabilities(5);
 * response.data.capabilities.forEach(cap => {
 *   console.log(`${cap.capability}: ${cap.permission}`);
 * });
 * ```
 */
export async function getRoleCapabilities(
  roleId: number
): Promise<ApiResponse<GetRoleCapabilitiesResponse>> {
  try {
    const response = await apiClient.get<ApiResponse<GetRoleCapabilitiesResponse>>(
      ROLES_CAPABILITIES_ENDPOINT,
      {
        params: {
          roleid: roleId,
        },
      }
    );
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(
      error,
      `Failed to fetch capabilities for role ${roleId}`
    );
    const statusCode = extractStatusCode(error);
    throw new AdminRolesApiError(
      message,
      statusCode,
      'FETCH_CAPABILITIES_ERROR',
      error
    );
  }
}

/**
 * Assigns a role to a user in a specific context
 *
 * Creates a new role assignment linking a user to a role within a particular
 * context (system, course category, course, module, or block). This grants
 * the user all capabilities associated with that role in that context and
 * any child contexts.
 *
 * API Endpoint: POST /api/v1/admin/roles/assign.php
 *
 * Required Capability: moodle/role:assign
 *
 * @param roleId - The unique identifier of the role to assign
 * @param userId - The unique identifier of the user to receive the role
 * @param contextId - The context ID where the role should be assigned
 * @param component - Optional plugin component responsible for assignment
 * @param itemId - Optional enrolment/auth instance ID
 * @returns Promise resolving to the assignment response
 * @throws AdminRolesApiError if the API call fails or assignment not permitted
 *
 * @example
 * ```typescript
 * // Assign teacher role to user 123 in course context 456
 * const response = await assignRole(4, 123, 456);
 * console.log(`Assignment created: ${response.data.assignment.id}`);
 * ```
 */
export async function assignRole(
  roleId: number,
  userId: number,
  contextId: number,
  component?: string,
  itemId?: number
): Promise<ApiResponse<AssignRoleResponse>> {
  try {
    const response = await apiClient.post<ApiResponse<AssignRoleResponse>>(
      ROLES_ASSIGN_ENDPOINT,
      {
        roleid: roleId,
        userid: userId,
        contextid: contextId,
        component: component ?? '',
        itemid: itemId ?? 0,
      }
    );
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(
      error,
      `Failed to assign role ${roleId} to user ${userId}`
    );
    const statusCode = extractStatusCode(error);
    throw new AdminRolesApiError(message, statusCode, 'ASSIGN_ROLE_ERROR', error);
  }
}

/**
 * Removes a role assignment from a user
 *
 * Deletes an existing role assignment, removing the user's access to
 * capabilities granted by that role in the associated context.
 *
 * API Endpoint: DELETE /api/v1/admin/roles/assign.php?id={id}
 *
 * Required Capability: moodle/role:assign
 *
 * @param roleAssignmentId - The unique identifier of the role assignment to remove
 * @returns Promise resolving to the unassignment response
 * @throws AdminRolesApiError if the API call fails or assignment not found
 *
 * @example
 * ```typescript
 * const response = await unassignRole(789);
 * if (response.data.removed) {
 *   console.log('Role assignment removed successfully');
 * }
 * ```
 */
export async function unassignRole(
  roleAssignmentId: number
): Promise<ApiResponse<UnassignRoleResponse>> {
  try {
    const response = await apiClient.delete<ApiResponse<UnassignRoleResponse>>(
      ROLES_ASSIGN_ENDPOINT,
      {
        params: {
          id: roleAssignmentId,
        },
      }
    );
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(
      error,
      `Failed to unassign role assignment ${roleAssignmentId}`
    );
    const statusCode = extractStatusCode(error);
    throw new AdminRolesApiError(message, statusCode, 'UNASSIGN_ROLE_ERROR', error);
  }
}

/**
 * Fetches all role assignments in a specific context
 *
 * Retrieves a list of all role assignments within a context, optionally
 * filtered by a specific role. This shows which users have which roles
 * in the given context.
 *
 * API Endpoint: GET /api/v1/admin/roles/assign.php?contextid={id}&roleid={id}
 *
 * Required Capability: moodle/role:assign
 *
 * @param contextId - The context ID to get assignments for
 * @param roleId - Optional role ID to filter assignments by
 * @returns Promise resolving to the role assignments response
 * @throws AdminRolesApiError if the API call fails
 *
 * @example
 * ```typescript
 * // Get all assignments in context 456
 * const allAssignments = await getRoleAssignments(456);
 *
 * // Get only teacher role assignments in context 456
 * const teacherAssignments = await getRoleAssignments(456, 4);
 * ```
 */
export async function getRoleAssignments(
  contextId: number,
  roleId?: number
): Promise<ApiResponse<GetRoleAssignmentsResponse>> {
  try {
    const params: Record<string, number> = {
      contextid: contextId,
    };

    if (roleId !== undefined) {
      params.roleid = roleId;
    }

    const response = await apiClient.get<ApiResponse<GetRoleAssignmentsResponse>>(
      ROLES_ASSIGN_ENDPOINT,
      { params }
    );
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(
      error,
      `Failed to fetch role assignments for context ${contextId}`
    );
    const statusCode = extractStatusCode(error);
    throw new AdminRolesApiError(
      message,
      statusCode,
      'FETCH_ASSIGNMENTS_ERROR',
      error
    );
  }
}

/**
 * Updates a capability permission for a role
 *
 * Modifies the permission level (ALLOW, PREVENT, PROHIBIT, or INHERIT)
 * for a specific capability on a role. This changes what users with
 * this role are allowed to do.
 *
 * Permission values:
 * - INHERIT (0): Uses permission from parent context
 * - ALLOW (1): Grants the capability
 * - PREVENT (-1): Denies the capability (can be overridden at lower context)
 * - PROHIBIT (-1000): Absolutely denies (cannot be overridden)
 *
 * API Endpoint: PUT /api/v1/admin/roles/capabilities.php
 *
 * Required Capability: moodle/role:override
 *
 * @param roleId - The unique identifier of the role to modify
 * @param capability - The capability name (e.g., "mod/assign:grade")
 * @param permission - The new permission value
 * @param contextId - Optional context ID for context-specific override
 * @returns Promise resolving to the updated capability response
 * @throws AdminRolesApiError if the API call fails or permission denied
 *
 * @example
 * ```typescript
 * import { Permission } from '@/features/admin/roles/types/role.types';
 *
 * // Allow students to view their own quiz results
 * const response = await updateRoleCapability(
 *   5, // Student role
 *   'mod/quiz:viewreports',
 *   Permission.ALLOW
 * );
 * ```
 */
export async function updateRoleCapability(
  roleId: number,
  capability: string,
  permission: Permission | number,
  contextId?: number
): Promise<ApiResponse<UpdateRoleCapabilityResponse>> {
  try {
    const requestBody: {
      roleid: number;
      capability: string;
      permission: number;
      contextid?: number;
    } = {
      roleid: roleId,
      capability,
      permission,
    };

    if (contextId !== undefined) {
      requestBody.contextid = contextId;
    }

    const response = await apiClient.put<ApiResponse<UpdateRoleCapabilityResponse>>(
      ROLES_CAPABILITIES_ENDPOINT,
      requestBody
    );
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(
      error,
      `Failed to update capability ${capability} for role ${roleId}`
    );
    const statusCode = extractStatusCode(error);
    throw new AdminRolesApiError(
      message,
      statusCode,
      'UPDATE_CAPABILITY_ERROR',
      error
    );
  }
}

/**
 * Fetches roles that can be assigned in a specific context
 *
 * Retrieves the list of roles that the current user is permitted to
 * assign in the given context. This respects the role assignment
 * restrictions configured in Moodle.
 *
 * API Endpoint: GET /api/v1/admin/roles/assign.php?contextid={id}&list=assignable
 *
 * Required Capability: moodle/role:assign
 *
 * @param contextId - The context ID to get assignable roles for
 * @returns Promise resolving to the assignable roles response
 * @throws AdminRolesApiError if the API call fails
 *
 * @example
 * ```typescript
 * // Get roles that can be assigned in course context 456
 * const response = await getAssignableRoles(456);
 * response.data.roles.forEach(role => {
 *   const count = response.data.assignCounts[role.id] || 0;
 *   console.log(`${role.name}: ${count} assignments`);
 * });
 * ```
 */
export async function getAssignableRoles(
  contextId: number
): Promise<ApiResponse<GetAssignableRolesResponse>> {
  try {
    const response = await apiClient.get<ApiResponse<GetAssignableRolesResponse>>(
      ROLES_ASSIGN_ENDPOINT,
      {
        params: {
          contextid: contextId,
          list: 'assignable',
        },
      }
    );
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(
      error,
      `Failed to fetch assignable roles for context ${contextId}`
    );
    const statusCode = extractStatusCode(error);
    throw new AdminRolesApiError(
      message,
      statusCode,
      'FETCH_ASSIGNABLE_ROLES_ERROR',
      error
    );
  }
}

// ============================================================================
// Utility Functions for Role Management
// ============================================================================

/**
 * Checks if a role can be deleted
 *
 * System roles (guest, default user, not logged in) cannot be deleted.
 * This is a client-side check; the backend will also validate.
 *
 * @param role - The role to check
 * @returns True if the role can be deleted, false otherwise
 */
export function canDeleteRole(role: Role): boolean {
  // Common system role shortnames that cannot be deleted
  const protectedRoles = ['guest', 'user', 'frontpage'];
  return !protectedRoles.includes(role.shortname);
}

/**
 * Formats a permission value for display
 *
 * @param permission - The permission value
 * @returns Human-readable permission string
 */
export function formatPermission(permission: Permission | number): string {
  switch (permission) {
    case 1:
      return 'Allow';
    case -1:
      return 'Prevent';
    case -1000:
      return 'Prohibit';
    case 0:
    default:
      return 'Inherit';
  }
}

/**
 * Gets the CSS class for a permission value (for styling)
 *
 * @param permission - The permission value
 * @returns CSS class name for the permission
 */
export function getPermissionClass(permission: Permission | number): string {
  switch (permission) {
    case 1:
      return 'permission-allow';
    case -1:
      return 'permission-prevent';
    case -1000:
      return 'permission-prohibit';
    case 0:
    default:
      return 'permission-inherit';
  }
}
