/**
 * Profile Feature - Barrel Export
 * 
 * This file serves as the public API for the profile feature module.
 * It re-exports all public components, pages, hooks, and types for convenient
 * importing throughout the application.
 * 
 * Usage:
 * ```typescript
 * // Instead of:
 * import { ProfileView } from '@/features/profile/components/ProfileView';
 * 
 * // Use:
 * import { ProfileView } from '@/features/profile';
 * ```
 * 
 * @module features/profile
 */

// ============================================================================
// Components
// ============================================================================

/**
 * ProfileView - Component for displaying user profile information
 * ProfileEditForm - Form component for editing user profile
 * AvatarUpload - Component for uploading and managing user avatar
 */
export { ProfileView } from './components/ProfileView';
export { ProfileEditForm } from './components/ProfileEditForm';
export { AvatarUpload } from './components/AvatarUpload';

// ============================================================================
// Pages
// ============================================================================

/**
 * ProfilePage - Main profile page showing user information
 * ProfileEditPage - Page for editing user profile with form
 */
export { ProfilePage } from './pages/ProfilePage';
export { ProfileEditPage } from './pages/ProfileEditPage';

// ============================================================================
// Hooks
// ============================================================================

/**
 * useProfile - Hook for fetching and managing user profile data
 * useUpdateProfile - Hook for updating user profile information
 */
export { useProfile } from './hooks/useProfile';
export { useUpdateProfile } from './hooks/useUpdateProfile';

// ============================================================================
// Types
// ============================================================================

/**
 * User - Core user entity type
 * UpdateProfilePayload - Payload type for profile update requests
 * AvatarUploadResponse - Response type from avatar upload operations
 * UserPreferences - User preferences and settings type
 */
export type {
  User,
  UpdateProfilePayload,
  AvatarUploadResponse,
  UserPreferences,
} from './types/profile.types';
