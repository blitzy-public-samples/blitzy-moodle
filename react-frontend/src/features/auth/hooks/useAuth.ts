/**
 * Authentication Hook - Minimal Stub
 *
 * This is a minimal stub implementation to satisfy imports.
 * The full auth feature will be implemented in a separate task.
 * Tests mock this hook completely.
 */

export interface AuthUser {
  id: number;
  pictureitemid: number;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  deleted?: boolean;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login?: (username: string, password: string) => Promise<void>;
  logout?: () => void;
  isLoading?: boolean;
}

/**
 * Hook to access authentication state
 *
 * NOTE: This is a stub implementation. Tests will mock this completely.
 * In production, this would connect to Redux auth state or context.
 */
export const useAuth = (): UseAuthReturn => {
  // Stub implementation - returns unauthenticated state
  // Real implementation would connect to auth context/Redux
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
  };
};
