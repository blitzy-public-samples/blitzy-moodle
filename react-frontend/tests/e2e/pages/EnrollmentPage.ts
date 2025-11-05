/**
 * EnrollmentPage - Page Object Model for Course Enrollment Workflow
 * 
 * This POM encapsulates all selectors and interactions for the course enrollment
 * interface in the React frontend. It provides a clean abstraction for E2E tests
 * to interact with enrollment methods, enrollment keys, confirmation dialogs,
 * and enrollment restrictions.
 * 
 * @module tests/e2e/pages/EnrollmentPage
 */

import { type Page, type Locator } from '@playwright/test';

/**
 * Interface for enrollment method data
 */
export interface EnrollmentMethod {
  id: string;
  name: string;
  description?: string;
  requiresKey?: boolean;
}

/**
 * Interface for enrollment restriction information
 */
export interface EnrollmentRestriction {
  type: string;
  message: string;
  canEnroll: boolean;
}

/**
 * EnrollmentPage - Page Object Model
 * 
 * Provides methods to interact with the course enrollment interface including:
 * - Clicking enroll buttons
 * - Entering enrollment keys
 * - Confirming/canceling enrollment
 * - Selecting enrollment methods
 * - Retrieving error and success messages
 * - Verifying enrollment status and restrictions
 */
export class EnrollmentPage {
  private readonly page: Page;
  
  // Core enrollment action locators
  private readonly enrollButton: Locator;
  private readonly enrollmentKeyInput: Locator;
  private readonly confirmEnrollButton: Locator;
  private readonly cancelEnrollButton: Locator;
  
  // Enrollment method and status locators
  private readonly enrollmentMethods: Locator;
  private readonly errorMessage: Locator;
  private readonly successMessage: Locator;
  private readonly restrictionMessage: Locator;
  
  // Dialog and container locators
  private readonly enrollmentDialog: Locator;
  private readonly enrollmentMethodsList: Locator;
  private readonly enrolledStatus: Locator;

  /**
   * Constructor for EnrollmentPage
   * 
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize core action locators using data-testid for reliability
    this.enrollButton = page.locator('[data-testid="enroll-button"]');
    this.enrollmentKeyInput = page.locator('[data-testid="enrollment-key-input"]');
    this.confirmEnrollButton = page.locator('[data-testid="confirm-enroll-button"]');
    this.cancelEnrollButton = page.locator('[data-testid="cancel-enroll-button"]');
    
    // Initialize enrollment method and status locators
    this.enrollmentMethods = page.locator('[data-testid="enrollment-method"]');
    this.errorMessage = page.locator('[data-testid="enrollment-error-message"]');
    this.successMessage = page.locator('[data-testid="enrollment-success-message"]');
    this.restrictionMessage = page.locator('[data-testid="enrollment-restriction-message"]');
    
    // Initialize dialog and container locators
    this.enrollmentDialog = page.locator('[data-testid="enrollment-dialog"]');
    this.enrollmentMethodsList = page.locator('[data-testid="enrollment-methods-list"]');
    this.enrolledStatus = page.locator('[data-testid="enrolled-status"]');
  }

  /**
   * Click the main enroll button to initiate enrollment
   * 
   * @throws Error if the enroll button is not visible or clickable
   */
  async clickEnroll(): Promise<void> {
    try {
      await this.enrollButton.waitFor({ state: 'visible', timeout: 10000 });
      await this.enrollButton.click();
    } catch (error) {
      throw new Error(`Failed to click enroll button: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enter an enrollment key into the enrollment key input field
   * 
   * @param key - The enrollment key to enter
   * @throws Error if the input field is not available or key entry fails
   */
  async enterEnrollmentKey(key: string): Promise<void> {
    if (!key || key.trim().length === 0) {
      throw new Error('Enrollment key cannot be empty');
    }

    try {
      await this.enrollmentKeyInput.waitFor({ state: 'visible', timeout: 10000 });
      await this.enrollmentKeyInput.clear();
      await this.enrollmentKeyInput.fill(key);
      
      // Verify the key was entered correctly
      const inputValue = await this.enrollmentKeyInput.inputValue();
      if (inputValue !== key) {
        throw new Error(`Enrollment key verification failed. Expected: ${key}, Got: ${inputValue}`);
      }
    } catch (error) {
      throw new Error(`Failed to enter enrollment key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Click the confirm enrollment button in the enrollment dialog
   * 
   * @throws Error if the confirm button is not available or click fails
   */
  async confirmEnrollment(): Promise<void> {
    try {
      await this.confirmEnrollButton.waitFor({ state: 'visible', timeout: 10000 });
      await this.confirmEnrollButton.click();
    } catch (error) {
      throw new Error(`Failed to confirm enrollment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Click the cancel button to cancel the enrollment process
   * 
   * @throws Error if the cancel button is not available or click fails
   */
  async cancelEnrollment(): Promise<void> {
    try {
      await this.cancelEnrollButton.waitFor({ state: 'visible', timeout: 10000 });
      await this.cancelEnrollButton.click();
      
      // Wait for dialog to close
      await this.enrollmentDialog.waitFor({ state: 'hidden', timeout: 5000 });
    } catch (error) {
      throw new Error(`Failed to cancel enrollment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Select a specific enrollment method from the available options
   * 
   * @param method - The name or ID of the enrollment method to select
   * @throws Error if the enrollment method is not found or selection fails
   */
  async selectEnrollmentMethod(method: string): Promise<void> {
    if (!method || method.trim().length === 0) {
      throw new Error('Enrollment method identifier cannot be empty');
    }

    try {
      // Wait for enrollment methods to be visible
      await this.enrollmentMethodsList.waitFor({ state: 'visible', timeout: 10000 });
      
      // Find and click the specific enrollment method
      const methodLocator = this.enrollmentMethods.filter({ hasText: method }).first();
      await methodLocator.waitFor({ state: 'visible', timeout: 5000 });
      await methodLocator.click();
    } catch (error) {
      throw new Error(`Failed to select enrollment method '${method}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available enrollment methods for the course
   * 
   * @returns Array of enrollment method data
   * @throws Error if enrollment methods cannot be retrieved
   */
  async getEnrollmentMethods(): Promise<EnrollmentMethod[]> {
    try {
      await this.enrollmentMethodsList.waitFor({ state: 'visible', timeout: 10000 });
      
      const methodElements = await this.enrollmentMethods.all();
      const methods: EnrollmentMethod[] = [];
      
      for (const element of methodElements) {
        const id = await element.getAttribute('data-method-id') || '';
        const name = await element.locator('[data-testid="method-name"]').textContent() || '';
        const description = await element.locator('[data-testid="method-description"]').textContent() || undefined;
        const requiresKeyAttr = await element.getAttribute('data-requires-key');
        const requiresKey = requiresKeyAttr === 'true';
        
        methods.push({
          id,
          name: name.trim(),
          description: description?.trim(),
          requiresKey,
        });
      }
      
      return methods;
    } catch (error) {
      throw new Error(`Failed to get enrollment methods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current error message text, if any
   * 
   * @returns The error message text, or null if no error is displayed
   */
  async getErrorMessage(): Promise<string | null> {
    try {
      const isVisible = await this.errorMessage.isVisible();
      if (!isVisible) {
        return null;
      }
      
      const text = await this.errorMessage.textContent();
      return text?.trim() || null;
    } catch (error) {
      // Return null if error message element doesn't exist
      return null;
    }
  }

  /**
   * Get the current success message text, if any
   * 
   * @returns The success message text, or null if no success message is displayed
   */
  async getSuccessMessage(): Promise<string | null> {
    try {
      const isVisible = await this.successMessage.isVisible();
      if (!isVisible) {
        return null;
      }
      
      const text = await this.successMessage.textContent();
      return text?.trim() || null;
    } catch (error) {
      // Return null if success message element doesn't exist
      return null;
    }
  }

  /**
   * Verify enrollment restriction and get restriction details
   * 
   * @returns Enrollment restriction information, or null if no restrictions
   */
  async verifyEnrollmentRestriction(): Promise<EnrollmentRestriction | null> {
    try {
      const isVisible = await this.restrictionMessage.isVisible();
      if (!isVisible) {
        return null;
      }
      
      const message = await this.restrictionMessage.textContent() || '';
      const type = await this.restrictionMessage.getAttribute('data-restriction-type') || 'unknown';
      const canEnrollAttr = await this.restrictionMessage.getAttribute('data-can-enroll');
      const canEnroll = canEnrollAttr !== 'false'; // Default to true if not explicitly false
      
      return {
        type,
        message: message.trim(),
        canEnroll,
      };
    } catch (error) {
      // Return null if restriction message element doesn't exist
      return null;
    }
  }

  /**
   * Wait for the enrollment dialog to appear
   * 
   * @param timeout - Maximum time to wait in milliseconds (default: 10000)
   * @throws Error if the dialog doesn't appear within the timeout
   */
  async waitForEnrollmentDialog(timeout: number = 10000): Promise<void> {
    try {
      await this.enrollmentDialog.waitFor({ state: 'visible', timeout });
    } catch (error) {
      throw new Error(`Enrollment dialog did not appear within ${timeout}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for enrollment success confirmation
   * 
   * @param timeout - Maximum time to wait in milliseconds (default: 15000)
   * @throws Error if success confirmation doesn't appear within the timeout
   */
  async waitForEnrollmentSuccess(timeout: number = 15000): Promise<void> {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout });
      
      // Verify the success message contains expected text
      const message = await this.getSuccessMessage();
      if (!message || !message.toLowerCase().includes('success')) {
        throw new Error(`Unexpected success message: ${message}`);
      }
    } catch (error) {
      throw new Error(`Enrollment success not confirmed within ${timeout}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify that the user is enrolled in the course
   * 
   * @returns True if enrolled, false otherwise
   */
  async verifyEnrolled(): Promise<boolean> {
    try {
      // Check for enrolled status indicator
      const isStatusVisible = await this.enrolledStatus.isVisible();
      if (isStatusVisible) {
        const statusText = await this.enrolledStatus.textContent();
        return statusText?.toLowerCase().includes('enrolled') || false;
      }
      
      // Alternative check: Enroll button should not be visible if already enrolled
      const isEnrollButtonVisible = await this.enrollButton.isVisible();
      if (!isEnrollButtonVisible) {
        // Button not visible likely means user is already enrolled
        return true;
      }
      
      // Check for success message as another indicator
      const successMsg = await this.getSuccessMessage();
      if (successMsg && successMsg.toLowerCase().includes('enrolled')) {
        return true;
      }
      
      return false;
    } catch (error) {
      // If we can't determine enrollment status, return false
      return false;
    }
  }

  /**
   * Complete full enrollment workflow with enrollment key
   * 
   * @param enrollmentKey - The enrollment key to use (optional)
   * @returns True if enrollment succeeded, false otherwise
   */
  async completeEnrollment(enrollmentKey?: string): Promise<boolean> {
    try {
      // Click the enroll button
      await this.clickEnroll();
      
      // Wait for enrollment dialog
      await this.waitForEnrollmentDialog();
      
      // If enrollment key is provided, enter it
      if (enrollmentKey) {
        await this.enterEnrollmentKey(enrollmentKey);
      }
      
      // Confirm enrollment
      await this.confirmEnrollment();
      
      // Wait for success confirmation
      await this.waitForEnrollmentSuccess();
      
      // Verify enrollment completed
      return await this.verifyEnrolled();
    } catch (error) {
      // Check if there's an error message
      const errorMsg = await this.getErrorMessage();
      if (errorMsg) {
        throw new Error(`Enrollment failed: ${errorMsg}`);
      }
      
      throw new Error(`Enrollment workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if enrollment dialog is currently visible
   * 
   * @returns True if dialog is visible, false otherwise
   */
  async isEnrollmentDialogVisible(): Promise<boolean> {
    try {
      return await this.enrollmentDialog.isVisible();
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if the enroll button is enabled and clickable
   * 
   * @returns True if button is enabled, false otherwise
   */
  async isEnrollButtonEnabled(): Promise<boolean> {
    try {
      const isVisible = await this.enrollButton.isVisible();
      if (!isVisible) {
        return false;
      }
      
      const isDisabled = await this.enrollButton.isDisabled();
      return !isDisabled;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for page to fully load with enrollment options
   * 
   * @param timeout - Maximum time to wait in milliseconds (default: 15000)
   */
  async waitForPageLoad(timeout: number = 15000): Promise<void> {
    try {
      // Wait for either the enroll button or enrolled status to be visible
      await this.page.waitForLoadState('networkidle', { timeout });
      
      // Wait for either enrolled status or enroll button to appear
      await Promise.race([
        this.enrollButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
        this.enrolledStatus.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      ]);
    } catch (error) {
      throw new Error(`Page did not load within ${timeout}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
