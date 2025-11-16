import type { Page, Locator } from '@playwright/test';

/**
 * Interface representing assignment information
 */
export interface AssignmentInfo {
  title: string;
  description: string;
  dueDate: string | null;
}

/**
 * Interface representing submission status information
 */
export interface SubmissionStatus {
  status: string;
  submittedDate: string | null;
  isEditable: boolean;
  hasSubmission: boolean;
}

/**
 * Interface representing submitted file information
 */
export interface SubmittedFile {
  name: string;
  size: string;
  uploadDate: string;
}

/**
 * Interface representing feedback information
 */
export interface FeedbackInfo {
  grade: string | null;
  comment: string | null;
  feedbackDate: string | null;
}

/**
 * Interface representing submission history entry
 */
export interface SubmissionHistoryEntry {
  date: string;
  status: string;
  files: string[];
  modifiedBy: string;
}

/**
 * Page Object Model for Assignment submission interface
 * 
 * Encapsulates all selectors and interactions for the assignment page including:
 * - Assignment information display (title, description, due date)
 * - Submission status and controls
 * - File upload functionality (both file picker and drag-and-drop)
 * - Text editor for submissions
 * - Feedback and grading information
 * - Submission history
 * 
 * Used by E2E tests to perform assignment-related operations such as:
 * - Viewing assignment details
 * - Submitting assignments with files and/or text
 * - Editing existing submissions
 * - Viewing feedback and grades
 * - Checking submission history
 */
export class AssignmentPage {
  private readonly page: Page;
  
  // Locators for assignment information
  private readonly assignmentTitle: Locator;
  private readonly assignmentDescription: Locator;
  private readonly dueDate: Locator;
  
  // Locators for submission controls
  private readonly submissionStatus: Locator;
  private readonly addSubmissionButton: Locator;
  private readonly submitButton: Locator;
  
  // Locators for file upload
  private readonly fileUploadZone: Locator;
  private readonly fileInput: Locator;
  private readonly fileList: Locator;
  private readonly uploadProgressBar: Locator;
  
  // Locators for text editor
  private readonly textEditor: Locator;
  
  // Locators for feedback and grading
  private readonly feedbackSection: Locator;
  private readonly gradeDisplay: Locator;
  private readonly commentSection: Locator;
  
  // Locators for submission history
  private readonly submissionHistory: Locator;
  
  // Locators for success messages
  private readonly successMessage: Locator;

  /**
   * Creates a new AssignmentPage instance
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize assignment information locators
    this.assignmentTitle = page.locator('[data-testid="assignment-title"], h1.assignment-title, .assignment-header h2');
    this.assignmentDescription = page.locator('[data-testid="assignment-description"], .assignment-description, .assignment-intro');
    this.dueDate = page.locator('[data-testid="assignment-due-date"], .assignment-duedate, .due-date');
    
    // Initialize submission control locators
    this.submissionStatus = page.locator('[data-testid="submission-status"], .submission-status, .submissionstatussubmitted, .submissionstatusnotyetsubmitted');
    this.addSubmissionButton = page.locator('[data-testid="add-submission-button"], button:has-text("Add submission"), button:has-text("Edit submission")');
    this.submitButton = page.locator('[data-testid="submit-assignment-button"], button:has-text("Submit assignment"), button[name="submitbutton"]');
    
    // Initialize file upload locators
    this.fileUploadZone = page.locator('[data-testid="file-upload-zone"], .file-upload-zone, .dndupload-target, .filemanager');
    this.fileInput = page.locator('input[type="file"][name*="files"], input[type="file"]');
    this.fileList = page.locator('[data-testid="file-list"], .dndupload-uploadedfiles, .fm-content-wrapper, .filemanager .fp-content');
    this.uploadProgressBar = page.locator('[data-testid="upload-progress"], .dndupload-progress, .fp-uploadbar');
    
    // Initialize text editor locator
    this.textEditor = page.locator('[data-testid="submission-text-editor"], .editor_atto_content, [contenteditable="true"], textarea[name*="onlinetext"]');
    
    // Initialize feedback and grading locators
    this.feedbackSection = page.locator('[data-testid="feedback-section"], .feedback, .submissionfeedback');
    this.gradeDisplay = page.locator('[data-testid="grade-display"], .grade, .gradegrade');
    this.commentSection = page.locator('[data-testid="comment-section"], .feedback-comment, .assignfeedback_comments');
    
    // Initialize submission history locator
    this.submissionHistory = page.locator('[data-testid="submission-history"], .submission-history, .submissionhistory');
    
    // Initialize success message locator
    this.successMessage = page.locator('[data-testid="success-message"], .alert-success, .notification-success, .successmessage');
  }

  /**
   * Wait for the assignment page to load completely
   * @throws Error if the page fails to load within timeout
   */
  async waitForAssignment(): Promise<void> {
    await this.assignmentTitle.waitFor({ state: 'visible', timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get assignment information including title, description, and due date
   * @returns Promise resolving to AssignmentInfo object
   */
  async getAssignmentInfo(): Promise<AssignmentInfo> {
    const title = await this.assignmentTitle.textContent() || '';
    const description = await this.assignmentDescription.textContent() || '';
    
    let dueDate: string | null = null;
    if (await this.dueDate.isVisible()) {
      dueDate = await this.dueDate.textContent();
    }
    
    return {
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate ? dueDate.trim() : null
    };
  }

  /**
   * Get the current submission status
   * @returns Promise resolving to SubmissionStatus object
   */
  async getSubmissionStatus(): Promise<SubmissionStatus> {
    const statusText = await this.submissionStatus.textContent() || '';
    const isEditable = await this.addSubmissionButton.isVisible();
    const hasSubmission = statusText.toLowerCase().includes('submitted');
    
    let submittedDate: string | null = null;
    if (hasSubmission) {
      const dateMatch = statusText.match(/\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        submittedDate = dateMatch[0];
      }
    }
    
    return {
      status: statusText.trim(),
      submittedDate,
      isEditable,
      hasSubmission
    };
  }

  /**
   * Click the "Add submission" or "Edit submission" button
   * @throws Error if the button is not available
   */
  async clickAddSubmission(): Promise<void> {
    await this.addSubmissionButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.addSubmissionButton.click();
    // Wait for submission form to load
    await this.page.waitForTimeout(500);
  }

  /**
   * Upload a file using the file picker
   * @param filePath - Absolute path to the file to upload
   * @throws Error if upload fails
   */
  async uploadFile(filePath: string): Promise<void> {
    // Wait for file input to be available
    await this.fileInput.waitFor({ state: 'attached', timeout: 5000 });
    
    // Set the file on the input element
    await this.fileInput.setInputFiles(filePath);
    
    // Wait for upload to complete
    await this.page.waitForTimeout(1000);
    
    // Verify file appears in the file list
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
    await this.page.locator(`text=${fileName}`).waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Upload a file using drag and drop
   * @param filePath - Absolute path to the file to upload
   * @throws Error if drag and drop fails
   */
  async uploadFileByDragDrop(filePath: string): Promise<void> {
    // Wait for upload zone to be visible
    await this.fileUploadZone.waitFor({ state: 'visible', timeout: 5000 });
    
    // Create a data transfer object with the file
    const fileInput = await this.page.locator('input[type="file"]').first().elementHandle();
    if (!fileInput) {
      throw new Error('File input not found for drag and drop');
    }
    
    // Set the file using the hidden input
    await this.fileInput.setInputFiles(filePath);
    
    // Wait for upload to complete
    await this.page.waitForTimeout(1000);
    
    // Verify file appears in the file list
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
    await this.page.locator(`text=${fileName}`).waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Upload multiple files at once
   * @param filePaths - Array of absolute paths to files to upload
   * @throws Error if any upload fails
   */
  async uploadMultipleFiles(filePaths: string[]): Promise<void> {
    // Wait for file input to be available
    await this.fileInput.waitFor({ state: 'attached', timeout: 5000 });
    
    // Set multiple files on the input element
    await this.fileInput.setInputFiles(filePaths);
    
    // Wait for uploads to complete
    await this.page.waitForTimeout(2000);
    
    // Verify all files appear in the file list
    for (const filePath of filePaths) {
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
      await this.page.locator(`text=${fileName}`).waitFor({ state: 'visible', timeout: 10000 });
    }
  }

  /**
   * Remove a file from the submission file list
   * @param fileName - Name of the file to remove
   * @throws Error if file cannot be removed
   */
  async removeFile(fileName: string): Promise<void> {
    // Find the file in the list and click its remove button
    const fileItem = this.page.locator(`[data-testid="file-item"]:has-text("${fileName}"), .dndupload-file:has-text("${fileName}"), .fp-file:has-text("${fileName}")`);
    
    await fileItem.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click the delete/remove button associated with this file
    const removeButton = fileItem.locator('button:has-text("Delete"), button:has-text("Remove"), a:has-text("Delete"), .fp-file-delete');
    await removeButton.click();
    
    // Confirm deletion if a confirmation dialog appears
    const confirmButton = this.page.locator('button:has-text("Yes"), button:has-text("Confirm"), button:has-text("Delete")').first();
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }
    
    // Wait for file to be removed from the list
    await this.page.waitForTimeout(500);
  }

  /**
   * Enter text into the submission text editor
   * @param content - Text content to enter
   * @throws Error if text entry fails
   */
  async enterText(content: string): Promise<void> {
    await this.textEditor.waitFor({ state: 'visible', timeout: 5000 });
    
    // Clear any existing content
    await this.textEditor.clear();
    
    // Type the new content
    await this.textEditor.fill(content);
    
    // Wait for content to be registered
    await this.page.waitForTimeout(500);
  }

  /**
   * Submit the assignment by clicking the submit button
   * @throws Error if submission fails
   */
  async submitAssignment(): Promise<void> {
    await this.submitButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.submitButton.click();
    
    // Handle confirmation dialog if it appears
    const confirmButton = this.page.locator('button:has-text("Continue"), button:has-text("Submit"), button:has-text("Yes")').first();
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }
    
    // Wait for submission to process
    await this.page.waitForTimeout(1000);
  }

  /**
   * Click the edit submission button to modify an existing submission
   * @throws Error if edit button is not available
   */
  async editSubmission(): Promise<void> {
    const editButton = this.page.locator('[data-testid="edit-submission-button"], button:has-text("Edit submission"), a:has-text("Edit submission")');
    await editButton.waitFor({ state: 'visible', timeout: 5000 });
    await editButton.click();
    
    // Wait for edit form to load
    await this.page.waitForTimeout(500);
  }

  /**
   * Get the list of submitted files
   * @returns Promise resolving to array of SubmittedFile objects
   */
  async viewSubmittedFiles(): Promise<SubmittedFile[]> {
    const files: SubmittedFile[] = [];
    
    // Wait for file list to be visible
    if (!(await this.fileList.isVisible({ timeout: 2000 }))) {
      return files;
    }
    
    // Get all file items in the list
    const fileItems = this.fileList.locator('.dndupload-file, .fp-file, [data-testid="file-item"]');
    const count = await fileItems.count();
    
    for (let i = 0; i < count; i++) {
      const fileItem = fileItems.nth(i);
      const name = await fileItem.locator('.fp-filename, .file-name, [data-testid="file-name"]').textContent() || 'Unknown';
      const size = await fileItem.locator('.fp-filesize, .file-size, [data-testid="file-size"]').textContent() || 'Unknown';
      const uploadDate = await fileItem.locator('.fp-datemodified, .file-date, [data-testid="file-date"]').textContent() || 'Unknown';
      
      files.push({
        name: name.trim(),
        size: size.trim(),
        uploadDate: uploadDate.trim()
      });
    }
    
    return files;
  }

  /**
   * Download a submitted file by clicking its download link
   * @param fileName - Name of the file to download
   * @throws Error if file cannot be downloaded
   */
  async downloadSubmittedFile(fileName: string): Promise<void> {
    // Find the file in the list
    const fileItem = this.page.locator(`.dndupload-file:has-text("${fileName}"), .fp-file:has-text("${fileName}"), [data-testid="file-item"]:has-text("${fileName}")`);
    
    await fileItem.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click the download link or file name
    const downloadLink = fileItem.locator('a, .fp-filename, [data-testid="file-download"]').first();
    
    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await downloadLink.click();
    
    // Wait for the download to start
    await downloadPromise;
  }

  /**
   * Get feedback information including grade and comments
   * @returns Promise resolving to FeedbackInfo object
   */
  async getFeedback(): Promise<FeedbackInfo> {
    let grade: string | null = null;
    let comment: string | null = null;
    let feedbackDate: string | null = null;
    
    // Check if feedback section is visible
    if (await this.feedbackSection.isVisible({ timeout: 2000 })) {
      // Get grade if available
      if (await this.gradeDisplay.isVisible({ timeout: 1000 })) {
        grade = await this.gradeDisplay.textContent();
      }
      
      // Get comment if available
      if (await this.commentSection.isVisible({ timeout: 1000 })) {
        comment = await this.commentSection.textContent();
      }
      
      // Try to extract feedback date from the feedback section
      const feedbackText = await this.feedbackSection.textContent() || '';
      const dateMatch = feedbackText.match(/\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        feedbackDate = dateMatch[0];
      }
    }
    
    return {
      grade: grade ? grade.trim() : null,
      comment: comment ? comment.trim() : null,
      feedbackDate: feedbackDate ? feedbackDate.trim() : null
    };
  }

  /**
   * Get the assigned grade
   * @returns Promise resolving to grade string or null if not graded
   */
  async getGrade(): Promise<string | null> {
    if (await this.gradeDisplay.isVisible({ timeout: 2000 })) {
      const gradeText = await this.gradeDisplay.textContent();
      return gradeText ? gradeText.trim() : null;
    }
    return null;
  }

  /**
   * Get the submission history showing all previous submissions
   * @returns Promise resolving to array of SubmissionHistoryEntry objects
   */
  async viewSubmissionHistory(): Promise<SubmissionHistoryEntry[]> {
    const history: SubmissionHistoryEntry[] = [];
    
    // Check if submission history is visible
    if (!(await this.submissionHistory.isVisible({ timeout: 2000 }))) {
      return history;
    }
    
    // Get all history entries
    const historyItems = this.submissionHistory.locator('.submission-history-item, .submissionattempt, [data-testid="history-entry"]');
    const count = await historyItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = historyItems.nth(i);
      
      const dateText = await item.locator('.submission-date, .submissiondate, [data-testid="submission-date"]').textContent() || 'Unknown';
      const statusText = await item.locator('.submission-status, .submissionstatus, [data-testid="submission-status"]').textContent() || 'Unknown';
      const modifiedByText = await item.locator('.submission-user, .submissionuser, [data-testid="submission-user"]').textContent() || 'Unknown';
      
      // Get files in this submission
      const fileElements = item.locator('.submission-file, .submissionfile, [data-testid="submission-file"]');
      const fileCount = await fileElements.count();
      const files: string[] = [];
      
      for (let j = 0; j < fileCount; j++) {
        const fileName = await fileElements.nth(j).textContent();
        if (fileName) {
          files.push(fileName.trim());
        }
      }
      
      history.push({
        date: dateText.trim(),
        status: statusText.trim(),
        files,
        modifiedBy: modifiedByText.trim()
      });
    }
    
    return history;
  }

  /**
   * Verify that the file upload progress bar is displayed
   * @returns Promise resolving to true if progress bar is visible
   */
  async verifyUploadProgress(): Promise<boolean> {
    try {
      await this.uploadProgressBar.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for the submission success message to appear
   * @throws Error if success message does not appear within timeout
   */
  async waitForSubmissionSuccess(): Promise<void> {
    await this.successMessage.waitFor({ state: 'visible', timeout: 15000 });
    
    // Verify the message contains success-related text
    const messageText = await this.successMessage.textContent() || '';
    const successIndicators = ['success', 'submitted', 'saved', 'complete'];
    const hasSuccessIndicator = successIndicators.some(indicator => 
      messageText.toLowerCase().includes(indicator)
    );
    
    if (!hasSuccessIndicator) {
      throw new Error(`Success message found but does not indicate success: ${messageText}`);
    }
  }
}
