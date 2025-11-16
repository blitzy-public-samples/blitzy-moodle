/**
 * Page Object Model for User Profile Interface
 * 
 * Encapsulates selectors and interactions for user profile viewing and editing,
 * including profile display, edit forms, avatar upload with cropping, custom fields,
 * password changes, preferences, and privacy controls.
 * 
 * Used by profile.spec.ts E2E test.
 */

import type { Page, Locator } from '@playwright/test';

/**
 * Profile information data structure
 */
export interface ProfileInfo {
  firstName: string;
  lastName: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  customFields?: Record<string, any>;
}

/**
 * User preferences data structure
 */
export interface UserPreferences {
  language?: string;
  timezone?: string;
  emailNotifications?: Record<string, boolean>;
  theme?: string;
}

/**
 * Crop area coordinates for avatar cropping
 */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * ProfilePage - Page Object Model for user profile interface
 * 
 * Provides methods for:
 * - Viewing profile information
 * - Editing basic profile details
 * - Uploading and cropping avatar images
 * - Changing password
 * - Updating preferences (language, timezone, notifications)
 * - Managing privacy settings
 * - Handling custom profile fields
 */
export class ProfilePage {
  private readonly page: Page;

  // Profile display locators
  private readonly profileName: Locator;
  private readonly profileEmail: Locator;
  private readonly profileAvatar: Locator;
  private readonly profileBio: Locator;

  // Edit action locators
  private readonly editProfileButton: Locator;

  // Basic info edit locators
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly emailInput: Locator;
  private readonly bioEditor: Locator;

  // Avatar upload locators
  private readonly avatarCropper: Locator;

  // Password change locators
  private readonly changePasswordButton: Locator;
  private readonly oldPasswordInput: Locator;
  private readonly newPasswordInput: Locator;
  private readonly confirmPasswordInput: Locator;

  // Preferences locators
  private readonly preferencesForm: Locator;
  private readonly languageSelect: Locator;
  private readonly timezoneSelect: Locator;
  private readonly privacySelect: Locator;

  // Form action locators
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;

  /**
   * Initialize ProfilePage with Playwright Page object
   * 
   * @param page - Playwright Page instance
   */
  constructor(page: Page) {
    this.page = page;

    // Initialize profile display locators
    this.profileName = page.locator('[data-testid="profile-name"]');
    this.profileEmail = page.locator('[data-testid="profile-email"]');
    this.profileAvatar = page.locator('[data-testid="profile-avatar"]');
    this.profileBio = page.locator('[data-testid="profile-bio"]');

    // Initialize edit action locators
    this.editProfileButton = page.locator('[data-testid="edit-profile-button"]');

    // Initialize basic info edit locators
    this.firstNameInput = page.locator('[data-testid="first-name-input"]');
    this.lastNameInput = page.locator('[data-testid="last-name-input"]');
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.bioEditor = page.locator('[data-testid="bio-editor"]');

    // Initialize avatar upload locators
    this.avatarCropper = page.locator('[data-testid="avatar-cropper"]');

    // Initialize password change locators
    this.changePasswordButton = page.locator('[data-testid="change-password-button"]');
    this.oldPasswordInput = page.locator('[data-testid="old-password-input"]');
    this.newPasswordInput = page.locator('[data-testid="new-password-input"]');
    this.confirmPasswordInput = page.locator('[data-testid="confirm-password-input"]');

    // Initialize preferences locators
    this.preferencesForm = page.locator('[data-testid="preferences-form"]');
    this.languageSelect = page.locator('[data-testid="language-select"]');
    this.timezoneSelect = page.locator('[data-testid="timezone-select"]');
    this.privacySelect = page.locator('[data-testid="privacy-select"]');

    // Initialize form action locators
    this.saveButton = page.locator('[data-testid="save-button"]');
    this.cancelButton = page.locator('[data-testid="cancel-button"]');
  }

  /**
   * Wait for profile page to load completely
   * 
   * @throws Error if profile page doesn't load within timeout
   */
  async waitForProfile(): Promise<void> {
    await this.profileName.waitFor({ state: 'visible', timeout: 10000 });
    await this.profileEmail.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Extract profile information from the page
   * 
   * @returns ProfileInfo object with user profile data
   */
  async getProfileInfo(): Promise<ProfileInfo> {
    await this.waitForProfile();

    const fullName = await this.profileName.textContent();
    const email = await this.profileEmail.textContent();
    const bio = await this.profileBio.textContent();
    const avatarUrl = await this.profileAvatar.getAttribute('src');

    // Parse full name into first and last name
    const nameParts = fullName?.trim().split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      firstName,
      lastName,
      email: email?.trim() || '',
      bio: bio?.trim() || undefined,
      avatarUrl: avatarUrl || undefined,
    };
  }

  /**
   * Click the edit profile button to open edit form
   */
  async clickEditProfile(): Promise<void> {
    await this.editProfileButton.click();
    await this.firstNameInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Update basic profile information
   * 
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @param email - User's email address
   */
  async updateBasicInfo(firstName: string, lastName: string, email: string): Promise<void> {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.emailInput.fill(email);
  }

  /**
   * Update profile bio/description
   * 
   * @param bioContent - Bio text content
   */
  async updateBio(bioContent: string): Promise<void> {
    await this.bioEditor.fill(bioContent);
  }

  /**
   * Upload a new avatar image
   * 
   * @param filePath - Absolute path to image file
   */
  async uploadAvatar(filePath: string): Promise<void> {
    // Set the file input
    const fileInput = this.page.locator('input[type="file"][data-testid="avatar-file-input"]');
    await fileInput.setInputFiles(filePath);

    // Wait for cropper to appear
    await this.avatarCropper.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Use avatar cropping tool to adjust crop area
   * 
   * @param cropArea - Crop area coordinates and dimensions
   */
  async cropAvatar(cropArea: CropArea): Promise<void> {
    // Execute cropping via JavaScript to manipulate cropper component
    await this.page.evaluate((area) => {
      const cropperElement = document.querySelector('[data-testid="avatar-cropper"]');
      if (cropperElement) {
        // Dispatch custom event with crop data
        const event = new CustomEvent('crop', {
          detail: {
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
          },
        });
        cropperElement.dispatchEvent(event);
      }
    }, cropArea);
  }

  /**
   * Save cropped avatar image
   */
  async saveAvatar(): Promise<void> {
    const saveAvatarButton = this.page.locator('[data-testid="save-avatar-button"]');
    await saveAvatarButton.click();

    // Wait for avatar to be saved and modal to close
    await this.avatarCropper.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Update custom profile fields
   * 
   * @param fields - Record of field names to values
   */
  async updateCustomFields(fields: Record<string, any>): Promise<void> {
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      const fieldInput = this.page.locator(`[data-testid="custom-field-${fieldName}"]`);
      
      // Check if field exists
      const isVisible = await fieldInput.isVisible();
      if (!isVisible) {
        console.warn(`Custom field "${fieldName}" not found on page`);
        continue;
      }

      // Handle different input types
      const tagName = await fieldInput.evaluate((el) => el.tagName.toLowerCase());
      const inputType = await fieldInput.getAttribute('type');

      if (tagName === 'select') {
        await fieldInput.selectOption(String(fieldValue));
      } else if (inputType === 'checkbox') {
        const isChecked = await fieldInput.isChecked();
        if ((fieldValue && !isChecked) || (!fieldValue && isChecked)) {
          await fieldInput.click();
        }
      } else if (inputType === 'radio') {
        await fieldInput.check();
      } else {
        await fieldInput.fill(String(fieldValue));
      }
    }
  }

  /**
   * Change user password
   * 
   * @param oldPassword - Current password
   * @param newPassword - New password
   * @param confirmPassword - Confirm password (defaults to newPassword if not provided)
   */
  async changePassword(oldPassword: string, newPassword: string, confirmPassword?: string): Promise<void> {
    await this.changePasswordButton.click();

    // Wait for password change form to appear
    await this.oldPasswordInput.waitFor({ state: 'visible', timeout: 5000 });

    // Fill password fields
    await this.oldPasswordInput.fill(oldPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword ?? newPassword);
  }

  /**
   * Update user preferences
   * 
   * @param preferences - Preferences object with language, timezone, notifications
   */
  async updatePreferences(preferences: UserPreferences): Promise<void> {
    // Navigate to preferences section if needed
    const preferencesVisible = await this.preferencesForm.isVisible();
    if (!preferencesVisible) {
      const preferencesTab = this.page.locator('[data-testid="preferences-tab"]');
      if (await preferencesTab.isVisible()) {
        await preferencesTab.click();
        await this.preferencesForm.waitFor({ state: 'visible', timeout: 5000 });
      }
    }

    // Update language if provided
    if (preferences.language) {
      await this.setLanguage(preferences.language);
    }

    // Update timezone if provided
    if (preferences.timezone) {
      await this.setTimezone(preferences.timezone);
    }

    // Update email notifications if provided
    if (preferences.emailNotifications) {
      for (const [notificationType, enabled] of Object.entries(preferences.emailNotifications)) {
        await this.toggleEmailNotifications(notificationType, enabled);
      }
    }
  }

  /**
   * Change language preference
   * 
   * @param language - Language code (e.g., 'en', 'es', 'fr')
   */
  async setLanguage(language: string): Promise<void> {
    await this.languageSelect.selectOption(language);
  }

  /**
   * Change timezone preference
   * 
   * @param timezone - Timezone identifier (e.g., 'America/New_York', 'Europe/London')
   */
  async setTimezone(timezone: string): Promise<void> {
    await this.timezoneSelect.selectOption(timezone);
  }

  /**
   * Toggle email notification preference for specific notification type
   * 
   * @param notificationType - Type of notification (e.g., 'forum_posts', 'assignments')
   * @param enabled - Whether to enable or disable
   */
  async toggleEmailNotifications(notificationType: string, enabled: boolean): Promise<void> {
    const toggle = this.page.locator(`[data-testid="email-notification-toggle-${notificationType}"]`);
    const isChecked = await toggle.isChecked();

    // Only toggle if current state doesn't match desired state
    if ((enabled && !isChecked) || (!enabled && isChecked)) {
      await toggle.click();
    }
  }

  /**
   * Change profile privacy/visibility level
   * 
   * @param privacyLevel - Privacy level ('public', 'private', 'contacts')
   */
  async setPrivacy(privacyLevel: string): Promise<void> {
    await this.privacySelect.selectOption(privacyLevel);
  }

  /**
   * Save profile changes
   */
  async saveProfile(): Promise<void> {
    await this.saveButton.click();
  }

  /**
   * Cancel profile editing without saving
   */
  async cancelEdit(): Promise<void> {
    await this.cancelButton.click();
  }

  /**
   * Verify email verification message appears
   * 
   * @returns True if verification message is displayed
   */
  async verifyEmailVerification(): Promise<boolean> {
    const verificationMessage = this.page.locator('[data-testid="email-verification-message"]');
    try {
      await verificationMessage.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get validation error messages from the form
   * 
   * @returns Array of validation errors
   */
  async verifyValidationErrors(): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Wait for error container
    const errorContainer = this.page.locator('[data-testid="validation-errors"]');
    const hasErrors = await errorContainer.isVisible().catch(() => false);
    
    if (!hasErrors) {
      return errors;
    }

    // Get all error messages
    const errorElements = this.page.locator('[data-testid^="error-"]');
    const count = await errorElements.count();

    for (let i = 0; i < count; i++) {
      const errorElement = errorElements.nth(i);
      const field = await errorElement.getAttribute('data-field') || 'unknown';
      const message = await errorElement.textContent() || '';
      
      errors.push({
        field,
        message: message.trim(),
      });
    }

    return errors;
  }

  /**
   * Wait for profile save success confirmation
   */
  async waitForSaveSuccess(): Promise<void> {
    const successMessage = this.page.locator('[data-testid="save-success-message"]');
    await successMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * View profile as another user (for testing privacy settings)
   * 
   * Requires appropriate test setup with multiple user sessions
   * 
   * @returns Profile information visible to other user
   */
  async viewProfileAsOtherUser(): Promise<ProfileInfo | null> {
    // Check if profile is accessible
    const accessDenied = this.page.locator('[data-testid="access-denied-message"]');
    const isDenied = await accessDenied.isVisible().catch(() => false);
    
    if (isDenied) {
      return null;
    }

    // Get visible profile information
    try {
      return await this.getProfileInfo();
    } catch {
      return null;
    }
  }
}
