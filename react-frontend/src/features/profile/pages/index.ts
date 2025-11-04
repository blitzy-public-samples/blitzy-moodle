/**
 * Barrel export file for profile pages.
 *
 * This file provides convenient re-exports of all page components in the profile pages directory.
 * It enables cleaner imports throughout the application by allowing imports like:
 *
 * @example
 * import { ProfilePage, ProfileEditPage } from '@/features/profile/pages';
 *
 * Instead of:
 * import ProfilePage from '@/features/profile/pages/ProfilePage';
 * import ProfileEditPage from '@/features/profile/pages/ProfileEditPage';
 */

export { default as ProfilePage } from './ProfilePage';
export { default as ProfileEditPage } from './ProfileEditPage';
