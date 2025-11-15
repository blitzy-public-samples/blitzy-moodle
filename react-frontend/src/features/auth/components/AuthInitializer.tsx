/**
 * Authentication State Initializer Component
 *
 * Responsible for hydrating Redux authentication state from localStorage
 * on application startup. Solves the critical issue where Redux store
 * and localStorage are out of sync, causing UI inconsistencies.
 *
 * Problem Solved:
 * - Header component relies on Redux store for auth state
 * - useAuth hook reads directly from localStorage
 * - Without initialization, Redux is empty even when user is logged in
 * - This causes "Login" button to show when user is actually authenticated
 *
 * Initialization Flow:
 * 1. Component mounts on app startup (via Providers)
 * 2. Checks localStorage for existing access token
 * 3. Validates token format and expiration (client-side only)
 * 4. Extracts user info from JWT payload
 * 5. Dispatches initializeAuth action to hydrate Redux store
 * 6. Redux store now matches localStorage state
 * 7. UI renders correctly (Header shows user menu, not Login button)
 *
 * Security Notes:
 * - Client-side validation is for UX only, not security
 * - Server validates JWT signature on every API request
 * - Expired tokens will be refreshed by API interceptor
 * - Invalid tokens will trigger logout flow
 *
 * @module features/auth/components/AuthInitializer
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { initializeAuth } from '../store/authSlice';
import {
  getAccessToken,
  getRefreshToken,
  getUserFromToken,
  isTokenExpired,
} from '@/services/auth/authService';
import type { User, AuthTokens } from '../types/auth.types';
import { RoleArchetype } from '../types/auth.types';

/**
 * AuthInitializer Component
 *
 * Component that runs authentication initialization logic on mount and
 * blocks rendering of children until initialization is complete.
 * This prevents race conditions where UI renders before Redux state
 * is hydrated from localStorage.
 *
 * Usage:
 * ```tsx
 * <Providers>
 *   <AuthInitializer>
 *     <App />
 *   </AuthInitializer>
 * </Providers>
 * ```
 *
 * What it does:
 * - Runs once on mount (useEffect with empty deps)
 * - Checks for stored tokens in localStorage
 * - Validates token is not expired
 * - Extracts user data from JWT
 * - Dispatches Redux action to restore auth state
 * - Blocks rendering until initialization complete
 * - Logs initialization status to console
 *
 * What it doesn't do:
 * - Does NOT make API calls (uses stored token only)
 * - Does NOT refresh expired tokens (handled by interceptor)
 * - Does NOT show loading UI (initializes synchronously)
 */
export function AuthInitializer({ children }: { children: ReactNode }): ReactNode {
  const dispatch = useDispatch();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    /**
     * Initialize authentication state from localStorage
     *
     * This is the critical function that solves the Redux/localStorage
     * synchronization issue. It reads stored tokens, validates them,
     * and hydrates the Redux store.
     */
    const initializeAuthState = (): void => {
      console.log('[AuthInitializer] Starting authentication initialization...');

      // Step 1: Check for stored access token
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();

      if (!accessToken || !refreshToken) {
        console.log('[AuthInitializer] No stored tokens found. User is not authenticated.');
        return;
      }

      console.log('[AuthInitializer] Found stored tokens. Validating...');

      // Step 2: Validate access token is not expired
      // Note: Even if expired, we proceed because the API interceptor will refresh it
      const isExpired = isTokenExpired(accessToken);
      if (isExpired) {
        console.log('[AuthInitializer] Access token is expired. Will be refreshed on first API call.');
        // Continue anyway - the refresh token might still be valid
        // The API interceptor will handle refreshing the access token
      }

      // Step 3: Extract user info from JWT payload
      const tokenUser = getUserFromToken(accessToken);
      if (!tokenUser || !tokenUser.id) {
        console.warn('[AuthInitializer] Failed to extract user from token. Token may be invalid.');
        return;
      }

      console.log(`[AuthInitializer] Extracted user from token: ID=${tokenUser.id}, username=${tokenUser.username}`);

      // Step 4: Construct auth state objects
      // Note: We create a minimal User object from token data.
      // Full user profile can be fetched from API later if needed.
      
      // Helper function to map role names to RoleArchetype enum
      const mapToRoleArchetype = (roleName: string): RoleArchetype | undefined => {
        const roleMap: Record<string, RoleArchetype> = {
          'manager': RoleArchetype.MANAGER,
          'coursecreator': RoleArchetype.COURSECREATOR,
          'editingteacher': RoleArchetype.EDITINGTEACHER,
          'teacher': RoleArchetype.TEACHER,
          'student': RoleArchetype.STUDENT,
          'guest': RoleArchetype.GUEST,
          'user': RoleArchetype.USER,
          'frontpage': RoleArchetype.FRONTPAGE,
        };
        return roleMap[roleName.toLowerCase()];
      };

      const user: User = {
        id: tokenUser.id,
        username: tokenUser.username || '',
        email: '', // Not in token payload
        firstname: '', // Not in token payload
        lastname: '', // Not in token payload
        auth: 'jwt',
        confirmed: true,
        suspended: false,
        roles: tokenUser.roles?.map((roleName) => ({
          id: 0, // Not available from token
          name: roleName,
          shortname: roleName,
          archetype: mapToRoleArchetype(roleName),
        })) || [],
        capabilities: [], // Not available from token
      };

      const tokens: AuthTokens = {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour default
        tokenType: 'Bearer',
      };

      // Step 5: Dispatch Redux action to hydrate store
      console.log('[AuthInitializer] Dispatching initializeAuth action to Redux store...');
      dispatch(initializeAuth({ user, tokens }));

      console.log('[AuthInitializer] Authentication state initialized successfully!');
      console.log('[AuthInitializer] Redux store is now synchronized with localStorage.');
    };

    // Run initialization synchronously
    initializeAuthState();
    
    // Mark as initialized to allow rendering
    setIsInitialized(true);
  }, [dispatch]); // Run once on mount

  // Block rendering until initialization is complete
  // This prevents race conditions where Header renders before Redux state is hydrated
  if (!isInitialized) {
    return null;
  }

  return <>{children}</>;
}
