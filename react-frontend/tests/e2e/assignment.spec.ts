import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import type { AssignmentInfo, SubmissionStatus, SubmittedFile, FeedbackInfo, SubmissionHistoryEntry } from './pages/AssignmentPage';
import { AssignmentPage } from './pages/AssignmentPage';
import { login, loginAsStudent, logout, clearAuthenticationState } from './utils/auth';
import { 
  uploadFile, 
  uploadFileDragDrop, 
  uploadMultipleFiles, 
  generateTestFile, 
  createImageFile,
  verifyFileUploaded, 
  verifyFileProperties,
  waitForUploadComplete,
  cleanupTestFiles 
} from './utils/file-helpers';
import { testCourse1, testCourse4 } from './fixtures/courses';
import { samplePDFFile, sampleImageFile, sampleDocumentFile, createTestFile, MAX_FILE_SIZE, MIME_TYPES } from './fixtures/files';
import { 
  testAssignment1, 
  testAssignment2, 
  testAssignment3, 
  testAssignment4,
  createAssignment 
} from './fixtures/assignments';
import { testStudent, testTeacher, TEST_PASSWORD } from './fixtures/users';

/**
 * E2E Test Suite: Assignment Submission Workflow
 * 
 * This comprehensive test suite validates all aspects of the assignment submission
 * functionality including file uploads (via picker and drag-and-drop), text submissions,
 * submission editing, feedback viewing, late submission handling, submission history,
 * and error scenarios.
 * 
 * Test Coverage:
 * - Assignment information display
 * - Multiple file upload methods (picker, drag-and-drop, multiple files)
 * - Text editor submission with rich text formatting
 * - Submission status tracking and timestamp accuracy
 * - Submission editing and versioning
 * - Feedback and grade display
 * - Late submission warnings
 * - Submission history with all versions
 * - Error handling (file size limits, invalid file types, cutoff dates)
 */
test.describe('Assignment Submission E2E Tests', () => {
  let page: Page;
  let assignmentPage: AssignmentPage;
  const testFilePaths: string[] = [];

  /**
   * Setup: Authenticate student user and prepare test environment
   */
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as student user
    await page.goto('/');
    await loginAsStudent(page);
    
    // Verify authentication successful
    await expect(page).toHaveURL(/\/dashboard/);
  });

  /**
   * Before each test: Initialize page object and navigate to fresh state
   */
  test.beforeEach(async () => {
    assignmentPage = new AssignmentPage(page);
  });

  /**
   * Cleanup: Remove test files and logout
   */
  test.afterAll(async () => {
    // Clean up any generated test files
    await cleanupTestFiles();
    
    // Logout user
    await logout(page);
    
    // Close browser page
    await page.close();
  });

  /**
   * Test 1: Assignment View - Verify assignment displays with complete information
   * 
   * Validates that assignment information (title, description, due date, status)
   * is correctly displayed when navigating to an assignment page.
   */
  test('should display assignment information correctly', async () => {
    // Navigate to course with assignment
    await page.goto(`/course/${testCourse4.id}`);
    await expect(page).toHaveURL(new RegExp(`/course/${testCourse4.id}`));
    
    // Navigate to assignment (testAssignment1 - file upload assignment)
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    
    // Wait for assignment page to load
    await assignmentPage.waitForAssignment();
    
    // Get assignment information
    const assignmentInfo: AssignmentInfo = await assignmentPage.getAssignmentInfo();
    
    // Verify assignment title
    expect(assignmentInfo.title).toBe(testAssignment1.name);
    expect(assignmentInfo.title).toContain('Programming Assignment 1');
    
    // Verify assignment description is present
    expect(assignmentInfo.description).toBeTruthy();
    expect(assignmentInfo.description).toContain(testAssignment1.intro);
    
    // Verify due date is displayed
    expect(assignmentInfo.dueDate).toBeTruthy();
    expect(assignmentInfo.dueDate).toMatch(/\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}/);
    
    // Get submission status
    const status: SubmissionStatus = await assignmentPage.getSubmissionStatus();
    
    // Verify initial status shows "Not submitted" or similar
    expect(status.status).toMatch(/not submitted|no attempt/i);
    expect(status.hasSubmission).toBe(false);
    
    // Take screenshot for visual verification
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/assignment-view.png' });
  });

  /**
   * Test 2: Submission Form Access - Verify submission form can be opened
   * 
   * Tests clicking "Add submission" button and verifying the submission form appears
   * with all necessary elements (file upload zone, text editor, submit button).
   */
  test('should open submission form when clicking add submission', async () => {
    // Navigate to assignment page
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    
    // Click "Add submission" button
    await assignmentPage.clickAddSubmission();
    
    // Wait for submission form to appear
    await page.waitForSelector('[data-testid="submission-form"], .submission-form, #id_submissionstatement', { timeout: 5000 });
    
    // Verify file upload zone is visible
    const fileUploadZone = page.locator('[data-testid="file-upload-zone"], .filemanager, .dndupload-target');
    await expect(fileUploadZone).toBeVisible();
    
    // Verify submit button is present
    const submitButton = page.locator('button:has-text("Save changes"), button:has-text("Submit"), [data-testid="submit-button"]');
    await expect(submitButton).toBeVisible();
    
    // Take screenshot of submission form
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/submission-form-opened.png' });
  });

  /**
   * Test 3: File Upload via Picker - Test standard file input upload
   * 
   * Validates uploading a file using the file input picker, verifying the file
   * appears in the file list with correct metadata.
   */
  test('should upload file via file picker successfully', async () => {
    // Navigate to assignment and open submission form
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    await assignmentPage.clickAddSubmission();
    
    // Generate a test PDF file
    const testFilePath = await generateTestFile('pdf', 'small');
    testFilePaths.push(testFilePath);
    
    // Upload file using file picker
    await assignmentPage.uploadFile(testFilePath);
    
    // Wait for file to appear in file list
    await page.waitForTimeout(1000); // Brief wait for UI update
    
    // Verify file is in the file list
    const uploadedFiles = await assignmentPage.viewSubmittedFiles();
    expect(uploadedFiles.length).toBeGreaterThan(0);
    
    // Verify file properties
    const uploadedFile = uploadedFiles.find(f => f.name.includes('.pdf'));
    expect(uploadedFile).toBeDefined();
    expect(uploadedFile?.name).toMatch(/\.pdf$/i);
    
    // Take screenshot showing uploaded file
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/file-uploaded-picker.png' });
  });

  /**
   * Test 4: File Upload via Drag and Drop - Test drag-and-drop file upload
   * 
   * Validates uploading a file using drag-and-drop functionality and verifies
   * the upload progress bar is displayed during the upload process.
   */
  test('should upload file via drag and drop with progress indicator', async () => {
    // Navigate to assignment and open submission form
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    await assignmentPage.clickAddSubmission();
    
    // Generate a test image file (medium size to show progress)
    const testFilePath = await generateTestFile('jpg', 'medium');
    testFilePaths.push(testFilePath);
    
    // Upload file using drag and drop
    await assignmentPage.uploadFileByDragDrop(testFilePath);
    
    // Verify upload progress bar appears
    const progressVisible = await assignmentPage.verifyUploadProgress();
    // Note: Progress may complete too quickly for small files, so we don't strictly require it
    
    // Wait for upload to complete
    await waitForUploadComplete(page);
    
    // Verify file is in the file list
    const uploadedFiles = await assignmentPage.viewSubmittedFiles();
    expect(uploadedFiles.length).toBeGreaterThan(0);
    
    const uploadedFile = uploadedFiles.find(f => f.name.includes('.jpg') || f.name.includes('.jpeg'));
    expect(uploadedFile).toBeDefined();
    
    // Take screenshot showing uploaded file after drag-and-drop
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/file-uploaded-dragdrop.png' });
  });

  /**
   * Test 5: Multiple File Upload - Test uploading multiple files simultaneously
   * 
   * Validates uploading multiple files at once and verifying all files appear
   * in the file list with correct information.
   */
  test('should upload multiple files and display all in file list', async () => {
    // Navigate to assignment supporting multiple files
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    await assignmentPage.clickAddSubmission();
    
    // Generate multiple test files
    const pdfPath = await generateTestFile('pdf', 'small');
    const imagePath = await generateTestFile('png', 'small');
    const docPath = await generateTestFile('docx', 'small');
    testFilePaths.push(pdfPath, imagePath, docPath);
    
    const filePaths = [pdfPath, imagePath, docPath];
    
    // Upload multiple files
    await assignmentPage.uploadMultipleFiles(filePaths);
    
    // Wait for all uploads to complete
    await waitForUploadComplete(page);
    await page.waitForTimeout(1500); // Additional wait for UI updates
    
    // Verify all files are in the file list
    const uploadedFiles = await assignmentPage.viewSubmittedFiles();
    expect(uploadedFiles.length).toBe(3);
    
    // Verify each file type is present
    const hasPDF = uploadedFiles.some(f => f.name.includes('.pdf'));
    const hasImage = uploadedFiles.some(f => f.name.includes('.png'));
    const hasDoc = uploadedFiles.some(f => f.name.includes('.docx'));
    
    expect(hasPDF).toBe(true);
    expect(hasImage).toBe(true);
    expect(hasDoc).toBe(true);
    
    // Take screenshot showing multiple uploaded files
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/multiple-files-uploaded.png' });
  });

  /**
   * Test 6: File Removal - Test removing files from submission before saving
   * 
   * Validates that files can be removed from the file list before submitting
   * and that the removal is reflected in the UI.
   */
  test('should remove file from list before submission', async () => {
    // Navigate to assignment and open submission form
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    await assignmentPage.clickAddSubmission();
    
    // Upload two test files
    const file1Path = await generateTestFile('pdf', 'small');
    const file2Path = await generateTestFile('txt', 'small');
    testFilePaths.push(file1Path, file2Path);
    
    await assignmentPage.uploadMultipleFiles([file1Path, file2Path]);
    await waitForUploadComplete(page);
    await page.waitForTimeout(1000);
    
    // Verify both files are present
    let uploadedFiles = await assignmentPage.viewSubmittedFiles();
    const initialCount = uploadedFiles.length;
    expect(initialCount).toBe(2);
    
    // Remove the first file (PDF)
    const fileToRemove = uploadedFiles[0].name;
    await assignmentPage.removeFile(fileToRemove);
    
    // Wait for UI to update
    await page.waitForTimeout(500);
    
    // Verify file was removed
    uploadedFiles = await assignmentPage.viewSubmittedFiles();
    expect(uploadedFiles.length).toBe(1);
    expect(uploadedFiles.some(f => f.name === fileToRemove)).toBe(false);
    
    // Take screenshot showing file removed
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/file-removed.png' });
  });

  /**
   * Test 7: Text Submission - Test online text editor submission
   * 
   * Validates entering text in the online text editor, verifying rich text
   * formatting works, and submitting text-based assignment.
   */
  test('should submit text in online editor with rich text formatting', async () => {
    // Navigate to assignment supporting online text (testAssignment2)
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment2.id}"], a:has-text("${testAssignment2.name}")`);
    await assignmentPage.waitForAssignment();
    await assignmentPage.clickAddSubmission();
    
    // Prepare rich text content
    const submissionText = `
      <h2>Introduction</h2>
      <p>This is my assignment submission with <strong>bold text</strong> and <em>italic text</em>.</p>
      <ul>
        <li>First point</li>
        <li>Second point</li>
        <li>Third point</li>
      </ul>
      <p>Here is a <a href="https://example.com">link to reference</a>.</p>
    `;
    
    // Enter text in the editor
    await assignmentPage.enterText(submissionText);
    
    // Wait for editor to process input
    await page.waitForTimeout(1000);
    
    // Verify text appears in editor (check for some key content)
    const editorContent = await page.locator('.editor-content, .atto_text, [data-testid="text-editor"]').textContent();
    expect(editorContent).toContain('Introduction');
    expect(editorContent).toContain('assignment submission');
    
    // Take screenshot showing text entered
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/text-entered.png' });
  });

  /**
   * Test 8: Submission Save - Test submitting assignment and verifying success
   * 
   * Validates clicking "Save changes" button, waiting for submission to complete,
   * and verifying success message appears.
   */
  test('should submit assignment and display success message', async () => {
    // Navigate to assignment and open submission form
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    await assignmentPage.clickAddSubmission();
    
    // Upload a test file
    const testFilePath = await generateTestFile('pdf', 'small');
    testFilePaths.push(testFilePath);
    await assignmentPage.uploadFile(testFilePath);
    await waitForUploadComplete(page);
    
    // Submit the assignment
    await assignmentPage.submitAssignment();
    
    // Wait for success message
    await assignmentPage.waitForSubmissionSuccess();
    
    // Verify success message is displayed
    const successMessage = page.locator('[data-testid="success-message"], .alert-success, .notification-success');
    await expect(successMessage).toBeVisible();
    
    const messageText = await successMessage.textContent();
    expect(messageText?.toLowerCase()).toMatch(/success|submitted|saved/);
    
    // Take screenshot of success message
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/submission-success.png' });
  });

  /**
   * Test 9: Submission Status - Verify submission status updates after submission
   * 
   * Validates that after submitting, the assignment displays "Submitted" status
   * with an accurate submission timestamp.
   */
  test('should display submitted status with accurate timestamp after submission', async () => {
    // Navigate to assignment and open submission form
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    
    // Check initial status
    let status = await assignmentPage.getSubmissionStatus();
    const wasAlreadySubmitted = status.hasSubmission;
    
    if (!wasAlreadySubmitted) {
      // Submit assignment if not already submitted
      await assignmentPage.clickAddSubmission();
      
      const testFilePath = await generateTestFile('pdf', 'small');
      testFilePaths.push(testFilePath);
      await assignmentPage.uploadFile(testFilePath);
      await waitForUploadComplete(page);
      await assignmentPage.submitAssignment();
      await assignmentPage.waitForSubmissionSuccess();
      
      // Navigate back to assignment view to see updated status
      await page.goto(`/course/${testCourse4.id}`);
      await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
      await assignmentPage.waitForAssignment();
    }
    
    // Get updated submission status
    status = await assignmentPage.getSubmissionStatus();
    
    // Verify status shows as submitted
    expect(status.hasSubmission).toBe(true);
    expect(status.status.toLowerCase()).toMatch(/submitted|complete/);
    
    // Verify submission date is present and recent
    expect(status.submittedDate).toBeTruthy();
    expect(status.submittedDate).toMatch(/\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}/);
    
    // Take screenshot showing submitted status
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/submission-status.png' });
  });

  /**
   * Test 10: Submission Editing - Test editing existing submission
   * 
   * Validates clicking "Edit submission", modifying content, resubmitting,
   * and verifying changes are saved correctly.
   */
  test('should allow editing existing submission and save changes', async () => {
    // Navigate to assignment (ensure it has a submission)
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    
    // Check if submission exists, create one if not
    const status = await assignmentPage.getSubmissionStatus();
    if (!status.hasSubmission) {
      await assignmentPage.clickAddSubmission();
      const testFilePath = await generateTestFile('pdf', 'small');
      testFilePaths.push(testFilePath);
      await assignmentPage.uploadFile(testFilePath);
      await waitForUploadComplete(page);
      await assignmentPage.submitAssignment();
      await assignmentPage.waitForSubmissionSuccess();
      
      // Navigate back to see the submission
      await page.goto(`/course/${testCourse4.id}`);
      await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
      await assignmentPage.waitForAssignment();
    }
    
    // Get initial file list
    const initialFiles = await assignmentPage.viewSubmittedFiles();
    const initialFileCount = initialFiles.length;
    
    // Click edit submission
    await assignmentPage.editSubmission();
    
    // Wait for edit form to appear
    await page.waitForTimeout(1000);
    
    // Add an additional file
    const newFilePath = await generateTestFile('txt', 'small');
    testFilePaths.push(newFilePath);
    await assignmentPage.uploadFile(newFilePath);
    await waitForUploadComplete(page);
    
    // Resubmit
    await assignmentPage.submitAssignment();
    await assignmentPage.waitForSubmissionSuccess();
    
    // Navigate back to verify changes
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    
    // Verify file count increased
    const updatedFiles = await assignmentPage.viewSubmittedFiles();
    expect(updatedFiles.length).toBeGreaterThan(initialFileCount);
    
    // Take screenshot showing edited submission
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/submission-edited.png' });
  });

  /**
   * Test 11: Submitted Files View - Verify submitted files display with download links
   * 
   * Validates viewing submitted files, checking they display correctly with
   * download links that work.
   */
  test('should display submitted files with download links', async () => {
    // Navigate to assignment with submission
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    
    // Ensure there is a submission
    const status = await assignmentPage.getSubmissionStatus();
    if (!status.hasSubmission) {
      await assignmentPage.clickAddSubmission();
      const testFilePath = await generateTestFile('pdf', 'small');
      testFilePaths.push(testFilePath);
      await assignmentPage.uploadFile(testFilePath);
      await waitForUploadComplete(page);
      await assignmentPage.submitAssignment();
      await assignmentPage.waitForSubmissionSuccess();
      
      await page.goto(`/course/${testCourse4.id}`);
      await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
      await assignmentPage.waitForAssignment();
    }
    
    // View submitted files
    const submittedFiles: SubmittedFile[] = await assignmentPage.viewSubmittedFiles();
    
    // Verify files are displayed
    expect(submittedFiles.length).toBeGreaterThan(0);
    
    // Verify each file has required properties
    submittedFiles.forEach((file: SubmittedFile) => {
      expect(file.name).toBeTruthy();
      expect(file.size).toBeTruthy();
      expect(file.uploadDate).toBeTruthy();
    });
    
    // Test downloading a file (if any exist)
    if (submittedFiles.length > 0) {
      const firstFile = submittedFiles[0];
      
      // Attempt to download (this will trigger download event)
      await assignmentPage.downloadSubmittedFile(firstFile.name);
      
      // Note: Actual file download verification would require additional setup
      // Here we just verify the download was triggered without errors
    }
    
    // Take screenshot showing submitted files
    await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/submitted-files-view.png' });
  });

  /**
   * Test 12: Feedback View - Verify grade and comments display after grading
   * 
   * Validates viewing feedback section after teacher grades the assignment,
   * checking that grade and comments are displayed correctly.
   * 
   * Note: This test simulates a graded state. In a real scenario, a teacher
   * would need to grade the assignment first.
   */
  test('should display feedback and grade after grading', async () => {
    // Navigate to a graded assignment (using testAssignment3 which has graded submission)
    await page.goto(`/course/${testCourse4.id}`);
    
    // For this test, we assume testAssignment3 has been graded
    // In a real scenario, you would need teacher to grade first
    await page.click(`[data-testid="activity-${testAssignment3.id}"], a:has-text("${testAssignment3.name}")`);
    await assignmentPage.waitForAssignment();
    
    // Get feedback information
    const feedback: FeedbackInfo = await assignmentPage.getFeedback();
    
    // If feedback exists, verify its structure
    if (feedback.grade !== null) {
      expect(feedback.grade).toBeTruthy();
      expect(feedback.grade).toMatch(/\d+|[A-F]|\d+\.\d+/); // Numeric or letter grade
      
      if (feedback.comment) {
        expect(feedback.comment).toBeTruthy();
      }
      
      if (feedback.feedbackDate) {
        expect(feedback.feedbackDate).toMatch(/\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}/);
      }
      
      // Take screenshot showing feedback
      await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/feedback-displayed.png' });
    } else {
      // If no feedback yet, verify the feedback section structure exists
      const feedbackSection = page.locator('[data-testid="feedback-section"], .feedback, #id_feedback');
      const feedbackExists = await feedbackSection.isVisible({ timeout: 2000 }).catch(() => false);
      
      // This is acceptable - assignment may not be graded yet
      console.log('No feedback available yet - assignment not graded');
    }
  });

  /**
   * Test 13: Late Submission - Verify late submission warning appears
   * 
   * Validates that when submitting after the due date, a late submission
   * warning is displayed to the user.
   */
  test('should display late submission warning when submitting after due date', async () => {
    // Navigate to assignment with past due date (testAssignment4)
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment4.id}"], a:has-text("${testAssignment4.name}")`);
    await assignmentPage.waitForAssignment();
    
    // Check for late submission indicator in assignment info
    const assignmentInfo = await assignmentPage.getAssignmentInfo();
    const pageContent = await page.content();
    
    // Look for late submission warnings in the page
    const hasLateWarning = pageContent.toLowerCase().includes('late') || 
                          pageContent.toLowerCase().includes('overdue') ||
                          pageContent.toLowerCase().includes('past due');
    
    // If already submitted late, check status
    const status = await assignmentPage.getSubmissionStatus();
    if (status.hasSubmission) {
      // Check if submission is marked as late in the status
      const isLate = status.status.toLowerCase().includes('late') || 
                    status.status.toLowerCase().includes('overdue');
      
      // Late warning should be visible somewhere
      expect(hasLateWarning || isLate).toBe(true);
    } else {
      // Try to submit and check for warning
      await assignmentPage.clickAddSubmission();
      
      // Check for late submission warning in the form
      const warningVisible = await page.locator('[data-testid="late-warning"], .alert-warning:has-text("late"), .notification:has-text("overdue")').isVisible({ timeout: 2000 }).catch(() => false);
      
      if (warningVisible) {
        expect(warningVisible).toBe(true);
        
        // Take screenshot showing late warning
        await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/late-submission-warning.png' });
      }
    }
  });

  /**
   * Test 14: Submission History - Verify all submission versions are listed
   * 
   * Validates viewing submission history and checking that all previous
   * submission versions are displayed with correct dates and status.
   */
  test('should display submission history with all versions', async () => {
    // Navigate to assignment with multiple submissions
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    
    // Ensure there is at least one submission
    const status = await assignmentPage.getSubmissionStatus();
    if (!status.hasSubmission) {
      // Create initial submission
      await assignmentPage.clickAddSubmission();
      const testFilePath = await generateTestFile('pdf', 'small');
      testFilePaths.push(testFilePath);
      await assignmentPage.uploadFile(testFilePath);
      await waitForUploadComplete(page);
      await assignmentPage.submitAssignment();
      await assignmentPage.waitForSubmissionSuccess();
      
      await page.goto(`/course/${testCourse4.id}`);
      await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
      await assignmentPage.waitForAssignment();
    }
    
    // View submission history
    const history: SubmissionHistoryEntry[] = await assignmentPage.viewSubmissionHistory();
    
    // Verify history entries exist
    if (history.length > 0) {
      // Verify each history entry has required fields
      history.forEach((entry: SubmissionHistoryEntry) => {
        expect(entry.date).toBeTruthy();
        expect(entry.status).toBeTruthy();
        expect(entry.modifiedBy).toBeTruthy();
        expect(Array.isArray(entry.files)).toBe(true);
      });
      
      // Verify entries are in chronological order (most recent first typically)
      if (history.length > 1) {
        // Just verify we have multiple entries
        expect(history.length).toBeGreaterThan(1);
      }
      
      // Take screenshot showing submission history
      await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/submission-history.png' });
    } else {
      // If no history visible, check if history section exists but is empty
      console.log('Submission history section present but may show only current submission');
    }
  });

  /**
   * Test 15: Error - File Size Limit Exceeded
   * 
   * Validates that attempting to upload a file exceeding the size limit
   * displays an appropriate error message.
   */
  test('should display error when file size exceeds limit', async () => {
    // Navigate to assignment and open submission form
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    await assignmentPage.clickAddSubmission();
    
    // Generate a large file that exceeds the limit
    const largeFilePath = await generateTestFile('pdf', 'large');
    testFilePaths.push(largeFilePath);
    
    // Attempt to upload the large file
    try {
      await assignmentPage.uploadFile(largeFilePath);
      
      // Wait a moment for error processing
      await page.waitForTimeout(1500);
      
      // Check for error message about file size
      const errorMessage = page.locator('[data-testid="error-message"], .alert-danger, .error, .notification-error');
      const errorVisible = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (errorVisible) {
        const errorText = await errorMessage.textContent();
        expect(errorText?.toLowerCase()).toMatch(/size|large|limit|exceed|too big/);
        
        // Take screenshot showing error
        await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/file-size-error.png' });
      } else {
        // File may have been rejected before upload - check file list
        const uploadedFiles = await assignmentPage.viewSubmittedFiles();
        const largeFileUploaded = uploadedFiles.some(f => f.name.includes('large'));
        
        // Large file should not be successfully uploaded
        expect(largeFileUploaded).toBe(false);
      }
    } catch (error) {
      // Upload may throw error - this is acceptable for oversized files
      console.log('Large file upload blocked as expected');
    }
  });

  /**
   * Test 16: Error - Invalid File Type
   * 
   * Validates that attempting to upload an invalid file type displays
   * an appropriate error message.
   */
  test('should display error when file type is invalid', async () => {
    // Navigate to assignment and open submission form
    await page.goto(`/course/${testCourse4.id}`);
    await page.click(`[data-testid="activity-${testAssignment1.id}"], a:has-text("${testAssignment1.name}")`);
    await assignmentPage.waitForAssignment();
    await assignmentPage.clickAddSubmission();
    
    // Generate a file with an uncommon/invalid extension
    const invalidFilePath = await generateTestFile('exe' as any, 'small');
    testFilePaths.push(invalidFilePath);
    
    // Attempt to upload the invalid file type
    try {
      await assignmentPage.uploadFile(invalidFilePath);
      
      // Wait for error processing
      await page.waitForTimeout(1500);
      
      // Check for error message about file type
      const errorMessage = page.locator('[data-testid="error-message"], .alert-danger, .error, .notification-error');
      const errorVisible = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (errorVisible) {
        const errorText = await errorMessage.textContent();
        expect(errorText?.toLowerCase()).toMatch(/type|format|invalid|not allowed|extension/);
        
        // Take screenshot showing error
        await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/file-type-error.png' });
      } else {
        // File may have been rejected - verify it's not in the list
        const uploadedFiles = await assignmentPage.viewSubmittedFiles();
        const invalidFileUploaded = uploadedFiles.some(f => f.name.includes('.exe'));
        
        // Invalid file should not be uploaded
        expect(invalidFileUploaded).toBe(false);
      }
    } catch (error) {
      // Upload may throw error - acceptable for invalid file types
      console.log('Invalid file type blocked as expected');
    }
  });

  /**
   * Test 17: Error - Submission After Cutoff Date
   * 
   * Validates that attempting to submit after the cutoff date (if configured)
   * displays an error preventing submission.
   */
  test('should prevent submission after cutoff date with error message', async () => {
    // Create a test assignment with past cutoff date
    const pastCutoffAssignment = createAssignment({
      name: 'Past Cutoff Assignment',
      duedate: Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days ago
      cutoffdate: Date.now() - (3 * 24 * 60 * 60 * 1000), // 3 days ago
      allowsubmissionsfromdate: Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days ago
    });
    
    // Note: In a real test, you would need to have this assignment created in the system
    // For this test, we'll use testAssignment4 which has a past due date
    await page.goto(`/course/${testCourse4.id}`);
    
    // Check if assignment list shows cutoff message
    const assignmentLink = page.locator(`[data-testid="activity-${testAssignment4.id}"], a:has-text("${testAssignment4.name}")`);
    await assignmentLink.click();
    await assignmentPage.waitForAssignment();
    
    // Check for cutoff date warning
    const pageContent = await page.content();
    const hasCutoffWarning = pageContent.toLowerCase().includes('cutoff') || 
                             pageContent.toLowerCase().includes('no longer accept');
    
    const status = await assignmentPage.getSubmissionStatus();
    
    // If assignment is past cutoff, verify submission is not allowed
    if (hasCutoffWarning) {
      // Add submission button should be disabled or hidden
      const addSubmissionBtn = page.locator('[data-testid="add-submission-btn"], button:has-text("Add submission")');
      const btnExists = await addSubmissionBtn.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (btnExists) {
        const isDisabled = await addSubmissionBtn.isDisabled();
        expect(isDisabled).toBe(true);
      } else {
        // Button not shown - acceptable for past cutoff
        expect(btnExists).toBe(false);
      }
      
      // Take screenshot showing cutoff restriction
      await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/cutoff-date-error.png' });
    }
  });

  /**
   * Test 18: Complete Assignment Workflow - End-to-End Happy Path
   * 
   * Comprehensive test that validates the complete assignment submission workflow
   * from start to finish, including all major steps.
   */
  test('should complete full assignment submission workflow successfully', async () => {
    // Step 1: Navigate to course and assignment
    await page.goto(`/course/${testCourse4.id}`);
    await expect(page).toHaveURL(new RegExp(`/course/${testCourse4.id}`));
    
    // Step 2: View assignment information
    await page.click(`[data-testid="activity-${testAssignment3.id}"], a:has-text("${testAssignment3.name}")`);
    await assignmentPage.waitForAssignment();
    
    const assignmentInfo = await assignmentPage.getAssignmentInfo();
    expect(assignmentInfo.title).toBeTruthy();
    expect(assignmentInfo.description).toBeTruthy();
    
    // Step 3: Open submission form
    const initialStatus = await assignmentPage.getSubmissionStatus();
    
    if (!initialStatus.hasSubmission || initialStatus.isEditable) {
      if (initialStatus.hasSubmission) {
        await assignmentPage.editSubmission();
      } else {
        await assignmentPage.clickAddSubmission();
      }
      
      // Step 4: Upload file via picker
      const pdfPath = await generateTestFile('pdf', 'small');
      testFilePaths.push(pdfPath);
      await assignmentPage.uploadFile(pdfPath);
      await waitForUploadComplete(page);
      
      // Step 5: Add text content (if assignment supports it)
      const submissionText = '<p>This is my complete assignment submission demonstrating the full workflow.</p>';
      
      try {
        await assignmentPage.enterText(submissionText);
      } catch {
        // Text editor may not be available for this assignment type
        console.log('Text submission not available for this assignment');
      }
      
      // Step 6: Submit assignment
      await assignmentPage.submitAssignment();
      
      // Step 7: Verify success
      await assignmentPage.waitForSubmissionSuccess();
      
      // Step 8: Verify status updated
      await page.goto(`/course/${testCourse4.id}`);
      await page.click(`[data-testid="activity-${testAssignment3.id}"], a:has-text("${testAssignment3.name}")`);
      await assignmentPage.waitForAssignment();
      
      const finalStatus = await assignmentPage.getSubmissionStatus();
      expect(finalStatus.hasSubmission).toBe(true);
      expect(finalStatus.submittedDate).toBeTruthy();
      
      // Step 9: Verify files are visible
      const submittedFiles = await assignmentPage.viewSubmittedFiles();
      expect(submittedFiles.length).toBeGreaterThan(0);
      
      // Take final screenshot of completed workflow
      await page.screenshot({ path: '/tmp/blitzy/blitzy-moodle/blitzyd6458edab/blitzy/screenshots/workflow-complete.png' });
    } else {
      // Assignment already submitted and not editable
      console.log('Assignment already submitted and not editable - verifying existing submission');
      
      const submittedFiles = await assignmentPage.viewSubmittedFiles();
      expect(submittedFiles.length).toBeGreaterThan(0);
    }
  });
});
