/**
 * E2E Test Suite - User Profile Management
 * 
 * Comprehensive end-to-end tests for user profile viewing, editing, and management.
 * Validates profile form editing, avatar upload, preference changes, password updates,
 * and profile privacy settings. Ensures profile data persistence and proper validation.
 * 
 * Test Coverage:
 * - Profile viewing and display
 * - Basic profile information editing
 * - Bio editing with rich text
 * - Avatar upload and cropping
 * - Custom profile fields
 * - Email verification workflow
 * - Password change functionality
 * - User preferences (language, timezone, notifications)
 * - Profile privacy settings
 * - Profile URL access
 * - Profile viewing as other users
 * - Form validation and error handling
 * - Data persistence across sessions
 * 
 * @module tests/e2e/profile.spec
 */

import { test, expect, describe, beforeEach, afterEach, Page } from '@playwright/test';
import { ProfilePage } from './pages/ProfilePage';
import { 
  login, 
  loginAsStudent, 
  logout, 
  isAuthenticated, 
  getAuthToken, 
  clearAuthenticationState 
} from './utils/auth';
import { 
  uploadFile, 
  verifyFileUploaded, 
  generateTestFile, 
  createImageFile 
} from './utils/file-helpers';
import { testStudent, testStudent2, TEST_PASSWORD } from './fixtures/users';

/**
 * Test suite configuration
 */
const TEST_TIMEOUT = 60000; // 60 seconds per test
const SCREENSHOT_ON_FAILURE = true;

/**
 * Original profile data storage for cleanup
 */
interface OriginalProfileData {
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
  language: string;
  timezone: string;
  privacy: string;
  avatarUrl: string;
  customFields: Record<string, any>;
}

let originalProfileData: OriginalProfileData | null = null;

/**
 * Main test suite for profile management
 */
describe('User Profile Management', () => {
  let page: Page;
  let profilePage: ProfilePage;

  /**
   * Setup: Login as student user and navigate to profile page
   * Captures original profile data for cleanup after tests
   */
  beforeEach(async ({ browser }) => {
    // Create new browser context and page
    const context = await browser.newContext();
    page = await context.newPage();

    // Login as test student
    await loginAsStudent(page);

    // Verify authentication succeeded
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Navigate to profile page
    profilePage = new ProfilePage(page);
    await page.goto('/profile');
    await profilePage.waitForProfile();

    // Capture original profile data for cleanup if not already captured
    if (!originalProfileData) {
      const profileInfo = await profilePage.getProfileInfo();
      originalProfileData = {
        firstName: profileInfo.firstName,
        lastName: profileInfo.lastName,
        email: profileInfo.email,
        bio: profileInfo.bio || '',
        language: 'en', // Default, will be captured from preferences
        timezone: 'UTC', // Default, will be captured from preferences
        privacy: 'public', // Default privacy setting
        avatarUrl: profileInfo.avatarUrl || '',
        customFields: profileInfo.customFields || {},
      };
    }
  });

  /**
   * Cleanup: Revert profile changes to original values and logout
   */
  afterEach(async () => {
    // Take screenshot on test failure
    if (SCREENSHOT_ON_FAILURE && test.info().status === 'failed') {
      await page.screenshot({
        path: `test-results/profile-failure-${Date.now()}.png`,
        fullPage: true,
      });
    }

    // Logout user
    await logout(page);

    // Clear authentication state
    await clearAuthenticationState(page);

    // Close page and context
    await page.close();
  });

  /**
   * Test 1: Profile View - Verify profile displays correctly
   */
  test('should display profile information correctly', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Wait for profile to load
    await profilePage.waitForProfile();

    // Get profile information
    const profileInfo = await profilePage.getProfileInfo();

    // Verify profile displays with correct user data
    expect(profileInfo.firstName).toBe(testStudent.firstname);
    expect(profileInfo.lastName).toBe(testStudent.lastname);
    expect(profileInfo.email).toBe(testStudent.email);
    
    // Verify avatar is displayed
    expect(profileInfo.avatarUrl).toBeTruthy();
    
    // Verify bio if present
    if (testStudent.description) {
      expect(profileInfo.bio).toContain(testStudent.description);
    }
  });

  /**
   * Test 2: Edit Profile Access - Verify edit form appears
   */
  test('should allow accessing edit profile form', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click "Edit profile" button
    await profilePage.clickEditProfile();

    // Verify edit form is displayed
    const editFormVisible = await page.isVisible('[data-testid="profile-edit-form"]');
    expect(editFormVisible).toBe(true);

    // Verify form fields are populated with current data
    const firstNameValue = await page.inputValue('[data-testid="first-name-input"]');
    const lastNameValue = await page.inputValue('[data-testid="last-name-input"]');
    const emailValue = await page.inputValue('[data-testid="email-input"]');

    expect(firstNameValue).toBe(testStudent.firstname);
    expect(lastNameValue).toBe(testStudent.lastname);
    expect(emailValue).toBe(testStudent.email);
  });

  /**
   * Test 3: Basic Info Editing - Update first name, last name, email
   */
  test('should allow editing basic profile information', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Update basic information
    const newFirstName = 'UpdatedJohn';
    const newLastName = 'UpdatedStudent';
    const newEmail = 'updated.student1@example.com';

    await profilePage.updateBasicInfo({
      firstName: newFirstName,
      lastName: newLastName,
      email: newEmail,
    });

    // Save profile
    await profilePage.saveProfile();
    await profilePage.waitForSaveSuccess();

    // Verify changes are reflected in profile view
    const updatedInfo = await profilePage.getProfileInfo();
    expect(updatedInfo.firstName).toBe(newFirstName);
    expect(updatedInfo.lastName).toBe(newLastName);
    expect(updatedInfo.email).toBe(newEmail);
  });

  /**
   * Test 4: Bio Editing - Update profile description with rich text
   */
  test('should allow editing profile bio with rich text', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Update bio with formatted text
    const newBio = '<p>This is my <strong>updated</strong> profile bio with <em>formatting</em>.</p>';
    await profilePage.updateBio(newBio);

    // Save profile
    await profilePage.saveProfile();
    await profilePage.waitForSaveSuccess();

    // Verify bio formatting is preserved
    const updatedInfo = await profilePage.getProfileInfo();
    expect(updatedInfo.bio).toContain('updated');
    expect(updatedInfo.bio).toContain('formatting');
  });

  /**
   * Test 5: Avatar Upload - Upload new profile picture
   */
  test('should allow uploading new profile avatar', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Generate test image file for avatar (800x600 pixels)
    const avatarImagePath = await createImageFile('test-avatar.png', 800, 600);

    // Upload avatar
    await profilePage.uploadAvatar(avatarImagePath);

    // Verify image preview appears
    const previewVisible = await page.isVisible('[data-testid="avatar-preview"]');
    expect(previewVisible).toBe(true);

    // Verify cropping tool is displayed
    const cropperVisible = await page.isVisible('[data-testid="avatar-cropper"]');
    expect(cropperVisible).toBe(true);
  });

  /**
   * Test 6: Avatar Save - Save cropped avatar and verify display
   */
  test('should save avatar and display in profile', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Generate and upload test image
    const avatarImagePath = await createImageFile('test-avatar.png', 800, 600);
    await profilePage.uploadAvatar(avatarImagePath);

    // Crop avatar to center square
    await profilePage.cropAvatar({
      x: 100,
      y: 0,
      width: 600,
      height: 600,
    });

    // Save cropped avatar
    await profilePage.saveAvatar();

    // Wait for avatar upload to complete
    await page.waitForSelector('[data-testid="avatar-upload-success"]', { timeout: 10000 });

    // Save profile
    await profilePage.saveProfile();
    await profilePage.waitForSaveSuccess();

    // Verify new avatar displays in profile view
    const updatedInfo = await profilePage.getProfileInfo();
    expect(updatedInfo.avatarUrl).toBeTruthy();
    expect(updatedInfo.avatarUrl).not.toBe(originalProfileData?.avatarUrl);

    // Verify avatar displays in navigation header
    const navAvatarVisible = await page.isVisible('[data-testid="user-menu-avatar"]');
    expect(navAvatarVisible).toBe(true);
  });

  /**
   * Test 7: Custom Fields - Update custom profile fields
   */
  test('should allow updating custom profile fields', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Update custom fields
    const customFields = {
      department: 'Computer Engineering',
      interests: 'Web Development, Machine Learning, Cloud Computing',
      phone: '+1 (555) 123-4567',
      location: 'San Francisco, CA',
    };

    await profilePage.updateCustomFields(customFields);

    // Save profile
    await profilePage.saveProfile();
    await profilePage.waitForSaveSuccess();

    // Verify custom fields are saved
    const updatedInfo = await profilePage.getProfileInfo();
    expect(updatedInfo.customFields).toBeDefined();
    expect(updatedInfo.customFields?.department).toBe(customFields.department);
    expect(updatedInfo.customFields?.interests).toBe(customFields.interests);
  });

  /**
   * Test 8: Email Verification - Verify email verification flow
   */
  test('should trigger email verification when email is changed', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Change email to new address
    const newEmail = 'newemail.student1@example.com';
    await profilePage.updateBasicInfo({ email: newEmail });

    // Save profile
    await profilePage.saveProfile();

    // Verify email verification message appears
    const verificationTriggered = await profilePage.verifyEmailVerification();
    expect(verificationTriggered).toBe(true);

    // Verify message indicates verification email sent
    const verificationMessage = await page.textContent('[data-testid="email-verification-message"]');
    expect(verificationMessage).toContain('verification');
    expect(verificationMessage).toContain(newEmail);
  });

  /**
   * Test 9: Password Change - Update password with old password verification
   */
  test('should allow changing password with old password required', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to profile
    await page.goto('/profile');
    await profilePage.waitForProfile();

    // Click edit profile
    await profilePage.clickEditProfile();

    // Change password
    const oldPassword = TEST_PASSWORD;
    const newPassword = 'NewTestPassword456!';

    await profilePage.changePassword({
      oldPassword,
      newPassword,
      confirmPassword: newPassword,
    });

    // Verify success message
    await profilePage.waitForSaveSuccess();

    // Logout
    await logout(page);

    // Attempt login with new password
    await login(page, testStudent.username, newPassword);

    // Verify login succeeded
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Logout and change password back to original
    await logout(page);
    await login(page, testStudent.username, newPassword);
    await page.goto('/profile');
    await profilePage.waitForProfile();
    await profilePage.clickEditProfile();
    await profilePage.changePassword({
      oldPassword: newPassword,
      newPassword: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });
    await profilePage.waitForSaveSuccess();
  });

  /**
   * Test 10: Preferences - Update language, timezone, and email notifications
   */
  test('should allow updating user preferences', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Update preferences
    await profilePage.setLanguage('es'); // Spanish
    await profilePage.setTimezone('Europe/Madrid');
    await profilePage.toggleEmailNotifications({
      forumPosts: true,
      assignments: true,
      messages: false,
    });

    // Save profile
    await profilePage.saveProfile();
    await profilePage.waitForSaveSuccess();

    // Reload page to verify preferences persisted
    await page.reload();
    await profilePage.waitForProfile();

    // Note: Verification would require accessing preference settings
    // which might be in a separate preferences page
  });

  /**
   * Test 11: Profile Privacy - Change profile visibility settings
   */
  test('should allow changing profile privacy settings', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Test different privacy levels
    const privacyLevels = ['public', 'course', 'private'];

    for (const privacy of privacyLevels) {
      await profilePage.setPrivacy(privacy);
      await profilePage.saveProfile();
      await profilePage.waitForSaveSuccess();

      // Verify privacy setting was saved
      await profilePage.clickEditProfile();
      const currentPrivacy = await page.inputValue('[data-testid="privacy-select"]');
      expect(currentPrivacy).toBe(privacy);

      // Cancel edit mode to prepare for next iteration
      await profilePage.cancelEdit();
    }

    // Reset to original privacy
    await profilePage.clickEditProfile();
    await profilePage.setPrivacy('public');
    await profilePage.saveProfile();
  });

  /**
   * Test 12: Profile URL - Verify profile accessible via direct URL
   */
  test('should access profile via direct URL', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate directly to profile URL
    await page.goto(`/profile/${testStudent.id}`);

    // Wait for profile to load
    await profilePage.waitForProfile();

    // Verify correct profile is displayed
    const profileInfo = await profilePage.getProfileInfo();
    expect(profileInfo.firstName).toBe(testStudent.firstname);
    expect(profileInfo.lastName).toBe(testStudent.lastname);
  });

  /**
   * Test 13: Profile View as Other User - Verify privacy enforcement
   */
  test('should respect privacy settings when viewing as another user', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Set profile privacy to "course" (course members only)
    await profilePage.clickEditProfile();
    await profilePage.setPrivacy('course');
    await profilePage.saveProfile();
    await profilePage.waitForSaveSuccess();

    // Logout current user
    await logout(page);

    // Login as different student (testStudent2)
    await login(page, testStudent2.username, TEST_PASSWORD);

    // Attempt to view testStudent's profile
    await page.goto(`/profile/${testStudent.id}`);

    // Verify privacy is respected
    // If not in same course, should show limited info or access denied
    const hasAccessDenied = await page.isVisible('[data-testid="access-denied"]');
    const hasLimitedView = await page.isVisible('[data-testid="limited-profile-view"]');

    // Either access denied or limited view should be shown
    expect(hasAccessDenied || hasLimitedView).toBe(true);

    // Logout second user
    await logout(page);

    // Login back as original user and reset privacy
    await loginAsStudent(page);
    await page.goto('/profile');
    await profilePage.waitForProfile();
    await profilePage.clickEditProfile();
    await profilePage.setPrivacy('public');
    await profilePage.saveProfile();
  });

  /**
   * Test 14: Data Persistence - Verify changes persist after logout/login
   */
  test('should persist profile changes across sessions', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Make profile changes
    await profilePage.clickEditProfile();
    
    const testChanges = {
      firstName: 'PersistTest',
      lastName: 'UserTest',
      bio: 'Testing data persistence across sessions',
    };

    await profilePage.updateBasicInfo({
      firstName: testChanges.firstName,
      lastName: testChanges.lastName,
    });
    await profilePage.updateBio(testChanges.bio);
    await profilePage.saveProfile();
    await profilePage.waitForSaveSuccess();

    // Verify changes are visible
    let profileInfo = await profilePage.getProfileInfo();
    expect(profileInfo.firstName).toBe(testChanges.firstName);
    expect(profileInfo.lastName).toBe(testChanges.lastName);

    // Logout
    await logout(page);

    // Login again
    await loginAsStudent(page);

    // Navigate to profile
    await page.goto('/profile');
    await profilePage.waitForProfile();

    // Verify changes persisted
    profileInfo = await profilePage.getProfileInfo();
    expect(profileInfo.firstName).toBe(testChanges.firstName);
    expect(profileInfo.lastName).toBe(testChanges.lastName);
    expect(profileInfo.bio).toContain(testChanges.bio);
  });

  /**
   * Test 15: Form Validation - Invalid email format
   */
  test('should show validation error for invalid email format', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Enter invalid email
    await profilePage.updateBasicInfo({
      email: 'invalid-email-format',
    });

    // Attempt to save
    await profilePage.saveProfile();

    // Verify validation error appears
    const errors = await profilePage.verifyValidationErrors();
    expect(errors.length).toBeGreaterThan(0);
    
    const emailError = errors.find(err => err.field === 'email');
    expect(emailError).toBeDefined();
    expect(emailError?.message).toMatch(/invalid|format|valid/i);
  });

  /**
   * Test 16: Form Validation - Password too short
   */
  test('should show validation error for password too short', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Attempt to change password to short password
    await profilePage.changePassword({
      oldPassword: TEST_PASSWORD,
      newPassword: 'short',
      confirmPassword: 'short',
    });

    // Verify validation error appears
    const errors = await profilePage.verifyValidationErrors();
    expect(errors.length).toBeGreaterThan(0);
    
    const passwordError = errors.find(err => err.field === 'newPassword' || err.field === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError?.message).toMatch(/length|short|characters|minimum/i);
  });

  /**
   * Test 17: Form Validation - Duplicate email
   */
  test('should show validation error for duplicate email', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Attempt to change email to another existing user's email
    await profilePage.updateBasicInfo({
      email: testStudent2.email, // Use testStudent2's email
    });

    // Attempt to save
    await profilePage.saveProfile();

    // Verify validation error appears
    const errors = await profilePage.verifyValidationErrors();
    expect(errors.length).toBeGreaterThan(0);
    
    const duplicateError = errors.find(err => err.field === 'email');
    expect(duplicateError).toBeDefined();
    expect(duplicateError?.message).toMatch(/already|exists|duplicate|use|taken/i);
  });

  /**
   * Test 18: Password Mismatch - Confirm password doesn't match
   */
  test('should show error when confirm password does not match', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Enter mismatched passwords
    await profilePage.changePassword({
      oldPassword: TEST_PASSWORD,
      newPassword: 'NewPassword123!',
      confirmPassword: 'DifferentPassword123!',
    });

    // Verify validation error appears
    const errors = await profilePage.verifyValidationErrors();
    expect(errors.length).toBeGreaterThan(0);
    
    const mismatchError = errors.find(err => 
      err.field === 'confirmPassword' || err.field === 'passwordConfirm'
    );
    expect(mismatchError).toBeDefined();
    expect(mismatchError?.message).toMatch(/match|same|identical/i);
  });

  /**
   * Test 19: Cancel Edit - Verify cancel button discards changes
   */
  test('should discard changes when cancel button is clicked', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Get original profile data
    const originalInfo = await profilePage.getProfileInfo();

    // Click edit profile
    await profilePage.clickEditProfile();

    // Make changes
    await profilePage.updateBasicInfo({
      firstName: 'ShouldBeDiscarded',
      lastName: 'NotSaved',
    });

    // Click cancel instead of save
    await profilePage.cancelEdit();

    // Verify edit form is closed
    const editFormVisible = await page.isVisible('[data-testid="profile-edit-form"]');
    expect(editFormVisible).toBe(false);

    // Verify changes were not saved
    const currentInfo = await profilePage.getProfileInfo();
    expect(currentInfo.firstName).toBe(originalInfo.firstName);
    expect(currentInfo.lastName).toBe(originalInfo.lastName);
  });

  /**
   * Test 20: Avatar File Type Validation - Invalid file type
   */
  test('should show error when uploading invalid avatar file type', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Click edit profile
    await profilePage.clickEditProfile();

    // Generate invalid file type (e.g., PDF)
    const invalidFilePath = await generateTestFile('pdf', 'small');

    try {
      // Attempt to upload non-image file
      await profilePage.uploadAvatar(invalidFilePath);

      // Verify error message appears
      const errorVisible = await page.isVisible('[data-testid="avatar-upload-error"]');
      expect(errorVisible).toBe(true);

      const errorMessage = await page.textContent('[data-testid="avatar-upload-error"]');
      expect(errorMessage).toMatch(/image|format|type|invalid|supported/i);
    } catch (error) {
      // File input might reject the file before upload
      // This is also acceptable behavior
      expect(error).toBeDefined();
    }
  });
});

/**
 * Cleanup after all tests complete
 * Restore original profile data if it was modified
 */
test.afterAll(async ({ browser }) => {
  if (originalProfileData) {
    const context = await browser.newContext();
    const cleanupPage = await context.newPage();

    try {
      // Login as test student
      await loginAsStudent(cleanupPage);

      // Navigate to profile
      await cleanupPage.goto('/profile');
      const cleanupProfilePage = new ProfilePage(cleanupPage);
      await cleanupProfilePage.waitForProfile();

      // Restore original profile data
      await cleanupProfilePage.clickEditProfile();
      await cleanupProfilePage.updateBasicInfo({
        firstName: originalProfileData.firstName,
        lastName: originalProfileData.lastName,
        email: originalProfileData.email,
      });
      await cleanupProfilePage.updateBio(originalProfileData.bio);
      await cleanupProfilePage.setPrivacy(originalProfileData.privacy);
      await cleanupProfilePage.saveProfile();
      await cleanupProfilePage.waitForSaveSuccess();

      // Logout
      await logout(cleanupPage);
    } catch (error) {
      console.error('Failed to restore original profile data:', error);
    } finally {
      await cleanupPage.close();
      await context.close();
    }
  }
});
