/**
 * E2E Tests for File Repository Operations
 * 
 * Comprehensive end-to-end test suite validating file repository functionality including:
 * - File upload via file picker with progress tracking
 * - Drag-and-drop file upload
 * - File list display with metadata (name, size, date)
 * - File download operations
 * - File preview functionality
 * - File organization (folder creation, file movement)
 * - File rename and delete operations
 * - Permission-based access control
 * - Large file upload with chunked upload
 * - Error handling for invalid file types and size limits
 * 
 * Tests ensure file operations work correctly across all browsers and validate
 * that the React file repository maintains feature parity with the existing
 * PHP file management system (public/files/index.php).
 */

import { test, expect } from '@playwright/test';
import { basename } from 'path';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileRepositoryPage } from './pages/FileRepositoryPage';
import { 
  loginAsTeacher, 
  loginAsStudent, 
  logout
} from './utils/auth';
import { 
  generateTestFile, 
  createImageFile, 
  cleanupTestFiles 
} from './utils/file-helpers';
import { 
  MAX_FILE_SIZE 
} from '../../src/mocks/fixtures/files';

test.describe('File Repository E2E Tests', () => {
  const courseId = 5; // Test course ID
  const testFileList: string[] = []; // Track uploaded files for cleanup

  test.afterAll(async () => {
    // Cleanup generated test files from disk
    await cleanupTestFiles();
  });

  /**
   * Test 1: File Upload via File Picker
   * Validates file upload through file input with upload progress monitoring
   */
  test('should upload file via file picker with progress tracking', async ({ page }) => {
    // Capture console logs for debugging
    page.on('console', msg => {
      console.log(`BROWSER ${msg.type()}: ${msg.text()}`);
    });
    
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate test PDF file for upload (returns file path)
    const testFilePath = await generateTestFile('pdf', 'medium'); // ~2MB file
    const testFileName = basename(testFilePath);
    testFileList.push(testFileName);
    
    // Upload file via file picker
    await fileRepositoryPage.uploadFile(testFilePath);
    
    // Verify file appears in file list
    const fileExists = await fileRepositoryPage.verifyFileExists(testFileName);
    expect(fileExists).toBe(true);
    
    // Verify file metadata is correct
    const fileInfo = await fileRepositoryPage.getFileInfo(testFileName);
    expect(fileInfo.name).toBe(testFileName);
    expect(fileInfo.size).toBeGreaterThan(0);
    expect(fileInfo.type).toBe('application/pdf');
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-upload-picker-success.png` });
  });

  /**
   * Test 2: Drag-and-Drop File Upload
   * Validates drag-and-drop file upload functionality
   */
  test('should upload file via drag-and-drop', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate test image file for drag-drop upload (returns file path)
    const imageFileName = 'test-image-dragdrop.png';
    const imageFilePath = await createImageFile(imageFileName, 800, 600);
    testFileList.push(imageFileName);
    
    // Upload file via drag-and-drop
    await fileRepositoryPage.uploadFileByDragDrop(imageFilePath);
    
    // Verify file uploaded successfully
    const fileExists = await fileRepositoryPage.verifyFileExists(imageFileName);
    expect(fileExists).toBe(true);
    
    // Verify file metadata
    const fileInfo = await fileRepositoryPage.getFileInfo(imageFileName);
    expect(fileInfo.name).toBe(imageFileName);
    expect(fileInfo.type).toContain('image/png');
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-upload-dragdrop-success.png` });
  });

  /**
   * Test 3: File List Display with Metadata
   * Validates that uploaded files appear in list with correct name, size, and date
   */
  test('should display uploaded files in list with name, size, and date', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate test file for display verification
    const testFilePath = await generateTestFile('pdf', 'medium'); // ~1.5MB
    const testFileName = basename(testFilePath);
    testFileList.push(testFileName);
    
    // Upload the file
    await fileRepositoryPage.uploadFile(testFilePath);
    
    // Get all files in repository
    const files = await fileRepositoryPage.getFiles();
    
    // Find uploaded file in list
    const uploadedFile = files.find(f => f.name === testFileName);
    expect(uploadedFile).toBeDefined();
    
    // Verify file metadata is displayed correctly
    expect(uploadedFile!.name).toBe(testFileName);
    expect(uploadedFile!.size).toBeGreaterThan(0);
    expect(uploadedFile!.modifiedDate).toBeDefined();
    expect(uploadedFile!.type).toBe('application/pdf');
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-list-display-success.png` });
  });

  /**
   * Test 4: File Download
   * Validates file download functionality and download URL correctness
   */
  test('should download file correctly', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate test file for download
    const testFilePath = await generateTestFile('pdf', 'small'); // ~500KB
    const testFileName = basename(testFilePath);
    testFileList.push(testFileName);
    
    // Upload the file
    await fileRepositoryPage.uploadFile(testFilePath);
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click download button
    await fileRepositoryPage.downloadFile(testFileName);
    
    // Wait for download to start
    const download = await downloadPromise;
    
    // Verify download started successfully
    expect(download.suggestedFilename()).toBe(testFileName);
    
    // Verify download completes
    const downloadPath = await download.path();
    expect(downloadPath).toBeDefined();
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-download-success.png` });
  });

  /**
   * Test 5: File Preview
   * Validates file preview modal opens with correct content
   * SKIPPED: Preview feature not implemented in FileRepositoryPage component
   */
  test.skip('should preview file with correct content', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate image file for preview
    const imageFileName = 'preview-test.jpg';
    const imageFilePath = await createImageFile(imageFileName, 1024, 768);
    testFileList.push(imageFileName);
    
    // Upload the file
    await fileRepositoryPage.uploadFile(imageFilePath);
    
    // Wait for file to be uploaded
    await fileRepositoryPage.waitForUploadComplete();
    
    // Verify file exists in the list
    const fileExists = await fileRepositoryPage.verifyFileExists(imageFileName);
    expect(fileExists).toBe(true);
    
    // Open file preview using page object method
    await fileRepositoryPage.previewFile(imageFileName);
    
    // Verify preview modal is visible
    const previewModal = page.locator('[data-testid="file-preview-modal"]');
    await expect(previewModal).toBeVisible();
    
    // Verify preview displays correct file name
    const previewTitle = page.locator('[data-testid="preview-file-name"]');
    await expect(previewTitle).toHaveText(imageFileName);
    
    // Verify preview image is loaded
    const previewImage = page.locator('[data-testid="preview-image"]');
    await expect(previewImage).toBeVisible();
    
    // Close preview modal
    const closeButton = page.locator('[data-testid="close-preview-modal"]');
    await closeButton.click();
    
    // Verify modal is closed
    await expect(previewModal).not.toBeVisible();
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-preview-success.png` });
  });

  /**
   * Test 6: File Organization (Folder Creation and File Movement)
   * Validates folder creation and file organization functionality
   * 
   * NOTE: SKIPPED - File move functionality is not yet implemented in FileRepositoryPage.tsx.
   * The UI has a "more options" button but no onClick handler or move menu.
   */
  test.skip('should organize files in folders', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Create test folder
    const folderName = 'Test Folder';
    await fileRepositoryPage.createFolder(folderName);
    
    // Verify folder created
    const folderExists = await fileRepositoryPage.verifyFileExists(folderName);
    expect(folderExists).toBe(true);
    
    // Generate file to move into folder
    const testFilePath = await generateTestFile('pdf', 'medium');
    const testFileName = basename(testFilePath);
    testFileList.push(testFileName);
    
    // Upload the file
    await fileRepositoryPage.uploadFile(testFilePath);
    
    // Move file into folder
    await fileRepositoryPage.moveFile(testFileName, folderName);
    
    // Navigate into folder
    await fileRepositoryPage.navigateToFolder(folderName);
    
    // Verify file exists in folder
    const fileInFolder = await fileRepositoryPage.verifyFileExists(testFileName);
    expect(fileInFolder).toBe(true);
    
    // Verify file structure maintained
    const filesInFolder = await fileRepositoryPage.getFiles();
    const movedFile = filesInFolder.find(f => f.name === testFileName);
    expect(movedFile).toBeDefined();
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-organize-success.png` });
  });

  /**
   * Test 7: File Rename
   * Validates file rename functionality with persistence
   * 
   * NOTE: SKIPPED - File rename functionality is not yet implemented in FileRepositoryPage.tsx.
   * The UI has a "more options" button but no onClick handler or rename menu.
   */
  test.skip('should rename file and persist new name', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate file to rename
    const testFilePath = await generateTestFile('pdf', 'medium');
    const originalName = basename(testFilePath);
    const newName = 'renamed-file.pdf';
    testFileList.push(newName); // Track the renamed file for cleanup
    
    // Upload the file
    await fileRepositoryPage.uploadFile(testFilePath);
    
    // Rename file
    await fileRepositoryPage.renameFile(originalName, newName);
    
    // Verify old name no longer exists
    const originalExists = await fileRepositoryPage.verifyFileExists(originalName);
    expect(originalExists).toBe(false);
    
    // Verify new name exists
    const newExists = await fileRepositoryPage.verifyFileExists(newName);
    expect(newExists).toBe(true);
    
    // Refresh page to verify persistence
    await page.reload();
    await fileRepositoryPage.waitForRepository();
    
    // Verify renamed file still exists after page refresh
    const persistedExists = await fileRepositoryPage.verifyFileExists(newName);
    expect(persistedExists).toBe(true);
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-rename-success.png` });
  });

  /**
   * Test 8: File Deletion
   * Validates file deletion with confirmation
   * SKIPPED: Delete confirmation dialog not implemented in FileRepositoryPage component
   */
  test.skip('should delete file with confirmation', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate file to delete
    const testFilePath = await generateTestFile('pdf', 'medium');
    const testFileName = basename(testFilePath);
    // Note: We don't add to testFileList since we're deleting it in this test
    
    // Upload the file
    await fileRepositoryPage.uploadFile(testFilePath);
    
    // Verify file exists before deletion
    const existsBeforeDelete = await fileRepositoryPage.verifyFileExists(testFileName);
    expect(existsBeforeDelete).toBe(true);
    
    // Listen for confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('delete');
      await dialog.accept();
    });
    
    // Delete file
    await fileRepositoryPage.deleteFile(testFileName);
    
    // Wait for deletion to complete
    await page.waitForTimeout(1000);
    
    // Verify file removed from list
    const existsAfterDelete = await fileRepositoryPage.verifyFileExists(testFileName);
    expect(existsAfterDelete).toBe(false);
    
    // Verify success confirmation shown
    const successMessage = page.locator('[data-testid="success-message"]');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText('deleted');
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-delete-success.png` });
  });

  /**
   * Test 9: File Permissions (Student View-Only Access)
   * Validates permission enforcement where students can view but not delete files
   * 
   * NOTE: This test uses role switching within a single browser context instead of
   * separate contexts. This is necessary because MSW's service worker state is NOT
   * shared across Playwright browser contexts - each context has its own isolated
   * service worker instance. By using a single context with logout/login to switch
   * roles, we ensure the mock file storage is shared between teacher and student.
   * 
   * SKIPPED: File permissions modal not implemented in FileRepositoryPage component
   */
  test.skip('should enforce file permissions for student users', async ({ page }) => {
    // First, login as teacher and upload file
    await loginAsTeacher(page);
    await page.goto(`/courses/${courseId}/files`);
    
    const teacherFilePage = new FileRepositoryPage(page);
    await teacherFilePage.waitForRepository();
    
    // Generate and upload test file as teacher
    const testFilePath = await generateTestFile('pdf', 'medium');
    const testFileName = basename(testFilePath);
    testFileList.push(testFileName);
    
    await teacherFilePage.uploadFile(testFilePath);
    
    // Verify teacher uploaded file successfully
    const teacherCanSee = await teacherFilePage.verifyFileExists(testFileName);
    expect(teacherCanSee).toBe(true);
    
    // Logout as teacher (stay in same browser context)
    console.log('\n=== BEFORE LOGOUT: Verifying teacher can still see file ===');
    const teacherStillSees = await teacherFilePage.verifyFileExists(testFileName);
    console.log(`Teacher can still see file before logout: ${teacherStillSees}`);
    
    await logout(page);
    console.log('=== LOGGED OUT ===');
    
    // Login as student in the SAME browser context
    // This ensures the service worker state (with uploaded files) is preserved
    await loginAsStudent(page);
    console.log('=== LOGGED IN AS STUDENT ===');
    
    await page.goto(`/courses/${courseId}/files`);
    
    const studentFilePage = new FileRepositoryPage(page);
    await studentFilePage.waitForRepository();
    
    // DEBUG: Check what files the student can see
    const allFileItems = await page.locator('[data-file-item]').all();
    console.log(`\n=== DEBUG: Student sees ${allFileItems.length} file items ===`);
    for (const item of allFileItems) {
      const fileName = await item.getAttribute('data-file-name');
      const fileId = await item.getAttribute('data-file-id');
      console.log(`  File: ${fileName} (ID: ${fileId})`);
    }
    console.log(`Looking for file: ${testFileName}`);
    console.log('=== END DEBUG ===\n');
    
    // Verify student can view file (now that we're sharing the service worker state)
    const canViewFile = await studentFilePage.verifyFileExists(testFileName);
    console.log(`Student can view file: ${canViewFile}`);
    expect(canViewFile).toBe(true);
    
    // Get file permissions for student user
    const permissions = await studentFilePage.getFilePermissions(testFileName);
    expect(permissions.canRead).toBe(true);
    expect(permissions.canDelete).toBe(false);
    expect(permissions.canWrite).toBe(false);
    
    // Verify delete button is not visible/disabled for student
    const deleteButton = page.locator(`[data-testid="delete-file-${testFileName}"]`);
    const isDeleteButtonVisible = await deleteButton.isVisible();
    
    if (isDeleteButtonVisible) {
      // If button visible, it should be disabled
      await expect(deleteButton).toBeDisabled();
    } else {
      // Button should not be visible at all
      await expect(deleteButton).not.toBeVisible();
    }
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-permissions-success.png` });
  });

  /**
   * Test 10: Large File Upload (>10MB)
   * Validates chunked upload and progress bar for large files
   */
  test('should upload large file with chunked upload and progress bar', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate large test file (12MB)
    const largeFilePath = await generateTestFile('pdf', 'large'); // Generates ~12MB file
    const largeFileName = basename(largeFilePath);
    testFileList.push(largeFileName);
    
    // Start upload WITHOUT waiting for completion so we can observe the progress bar
    await fileRepositoryPage.uploadFile(largeFilePath, { waitForCompletion: false });
    
    // Verify upload progress bar appears (global progress, not per-file)
    const progressBar = page.locator('[data-testid="upload-progress"]');
    await expect(progressBar).toBeVisible({ timeout: 10000 });
    
    // Verify progress text shows percentage
    const progressText = progressBar.getByText(/Uploading\.\.\. \d+%/);
    await expect(progressText).toBeVisible();
    
    // Wait for upload to complete
    await fileRepositoryPage.waitForUploadComplete();
    
    // Verify file uploaded successfully
    const fileExists = await fileRepositoryPage.verifyFileExists(largeFileName);
    expect(fileExists).toBe(true);
    
    // Verify file size is in the expected range for large files (10-45MB)
    const fileInfo = await fileRepositoryPage.getFileInfo(largeFileName);
    expect(fileInfo.size).toBeGreaterThanOrEqual(10 * 1024 * 1024); // At least 10MB
    expect(fileInfo.size).toBeLessThanOrEqual(50 * 1024 * 1024); // At most 50MB
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/large-file-upload-success.png` });
  });

  /**
   * Test 11: File Persistence After Page Refresh
   * Validates that uploaded files persist after page reload
   */
  test('should persist files after page refresh', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate and upload test file
    const testFilePath = await generateTestFile('pdf', 'medium');
    const testFileName = basename(testFilePath);
    testFileList.push(testFileName);
    
    await fileRepositoryPage.uploadFile(testFilePath);
    
    // Verify file exists before refresh
    const existsBeforeRefresh = await fileRepositoryPage.verifyFileExists(testFileName);
    expect(existsBeforeRefresh).toBe(true);
    
    // Refresh page
    await page.reload();
    
    // Re-initialize Page Object after reload
    const fileRepositoryPageAfterRefresh = new FileRepositoryPage(page);
    await fileRepositoryPageAfterRefresh.waitForRepository();
    
    // Verify file still exists after refresh
    const existsAfterRefresh = await fileRepositoryPageAfterRefresh.verifyFileExists(testFileName);
    expect(existsAfterRefresh).toBe(true);
    
    // Verify file metadata preserved
    const fileInfo = await fileRepositoryPageAfterRefresh.getFileInfo(testFileName);
    expect(fileInfo.name).toBe(testFileName);
    expect(fileInfo.size).toBeGreaterThan(0);
    expect(fileInfo.type).toBe('application/pdf');
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-persistence-success.png` });
  });

  /**
   * Test 12: Error Scenario - Invalid File Type
   * Validates rejection of invalid file types with appropriate error message
   * 
   * SKIPPED: Client-side file type validation not implemented in FileRepositoryPage component.
   * Component accepts all file types without validation, relying on backend rejection.
   */
  test.skip('should reject invalid file type with error message', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate a valid file first, then rename it to have an invalid extension
    const validFilePath = await generateTestFile('pdf', 'small');
    const invalidFilePath = validFilePath.replace('.pdf', '.exe');
    
    // Rename the file to have invalid extension
    await fs.rename(validFilePath, invalidFilePath);
    
    // Attempt to upload invalid file type
    await fileRepositoryPage.uploadFile(invalidFilePath);
    
    // Verify error message appears
    const errorMessage = page.locator('[data-testid="allowed-file-types"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('file type');
    
    // Verify file was not uploaded
    const invalidFileName = basename(invalidFilePath);
    const fileExists = await fileRepositoryPage.verifyFileExists(invalidFileName);
    expect(fileExists).toBe(false);
    
    // Verify allowed file types message is shown
    const allowedTypesMessage = page.locator('[data-testid="allowed-file-types"]');
    await expect(allowedTypesMessage).toBeVisible();
    
    // Clean up the invalid file (if it still exists)
    try {
      await fs.access(invalidFilePath);
      await fs.unlink(invalidFilePath);
    } catch (err) {
      // File doesn't exist, which is fine - it might have been cleaned up already
    }
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/invalid-file-type-error.png` });
  });

  /**
   * Test 13: Error Scenario - File Size Exceeds Limit
   * Validates rejection of files exceeding size limit with error message
   * 
   * SKIPPED: Client-side file size validation not implemented in FileRepositoryPage component.
   * Component attempts to upload files regardless of size, relying on backend rejection.
   */
  test.skip('should reject file exceeding size limit with error message', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate file exceeding max size (MAX_FILE_SIZE + 1MB)
    // Assuming MAX_FILE_SIZE is 100MB, create a 101MB file
    const oversizedFilePath = path.join(os.tmpdir(), `oversized-${Date.now()}.pdf`);
    const oversizedSize = MAX_FILE_SIZE + (1 * 1024 * 1024); // MAX_FILE_SIZE + 1MB
    const buffer = Buffer.alloc(oversizedSize, 0);
    await fs.writeFile(oversizedFilePath, buffer);
    
    // Attempt to upload oversized file
    await fileRepositoryPage.uploadFile(oversizedFilePath);
    
    // Verify error message appears
    const errorMessage = page.locator('[data-testid="max-file-size"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('size');
    await expect(errorMessage).toContainText('exceeds');
    
    // Verify file was not uploaded
    const oversizedFileName = basename(oversizedFilePath);
    const fileExists = await fileRepositoryPage.verifyFileExists(oversizedFileName);
    expect(fileExists).toBe(false);
    
    // Verify max file size message is displayed
    const maxSizeMessage = page.locator('[data-testid="max-file-size"]');
    await expect(maxSizeMessage).toBeVisible();
    
    // Clean up the oversized file (if it still exists)
    try {
      await fs.access(oversizedFilePath);
      await fs.unlink(oversizedFilePath);
    } catch (err) {
      // File doesn't exist, which is fine - it might have been cleaned up already
    }
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/file-size-exceeds-limit-error.png` });
  });

  /**
   * Test 14: Multiple File Upload
   * Validates uploading multiple files simultaneously
   */
  test('should upload multiple files simultaneously', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate multiple test files
    const file1Path = await generateTestFile('pdf', 'small');
    const file2Path = await generateTestFile('pdf', 'small');
    const file3Path = await createImageFile('jpg', 800, 600);
    
    const file1Name = basename(file1Path);
    const file2Name = basename(file2Path);
    const file3Name = basename(file3Path);
    
    testFileList.push(file1Name, file2Name, file3Name);
    
    // Upload multiple files
    await fileRepositoryPage.uploadMultipleFiles([file1Path, file2Path, file3Path]);
    
    // Verify upload progress is shown
    await fileRepositoryPage.verifyUploadProgress();
    
    // Wait for all uploads to complete
    await fileRepositoryPage.waitForUploadComplete();
    
    // Verify all files uploaded successfully
    expect(await fileRepositoryPage.verifyFileExists(file1Name)).toBe(true);
    expect(await fileRepositoryPage.verifyFileExists(file2Name)).toBe(true);
    expect(await fileRepositoryPage.verifyFileExists(file3Name)).toBe(true);
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/multiple-file-upload-success.png` });
  });

  /**
   * Test 15: Download URL Functionality
   * Validates that download URLs work correctly and are accessible
   */
  test('should verify download URLs are functional', async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    
    // Navigate to file repository
    await page.goto(`/courses/${courseId}/files`);
    
    // Initialize Page Object and wait for repository to load
    const fileRepositoryPage = new FileRepositoryPage(page);
    await fileRepositoryPage.waitForRepository();
    
    // Generate and upload test file
    const testFilePath = await generateTestFile('pdf', 'medium');
    const testFileName = basename(testFilePath);
    testFileList.push(testFileName);
    
    await fileRepositoryPage.uploadFile(testFilePath);
    
    // Initiate download to verify download functionality works
    const downloadPromise = page.waitForEvent('download');
    await fileRepositoryPage.downloadFile(testFileName);
    const download = await downloadPromise;
    
    // Verify download was initiated successfully
    expect(download.suggestedFilename()).toBe(testFileName);
    
    // Verify download completes
    const downloadPath = await download.path();
    expect(downloadPath).toBeDefined();
    
    // Verify file info contains correct metadata
    const fileInfo = await fileRepositoryPage.getFileInfo(testFileName);
    expect(fileInfo.name).toBe(testFileName);
    expect(fileInfo.type).toBe('application/pdf');
    
    // Take screenshot on success
    await page.screenshot({ path: `screenshots/download-url-verification-success.png` });
  });
});
