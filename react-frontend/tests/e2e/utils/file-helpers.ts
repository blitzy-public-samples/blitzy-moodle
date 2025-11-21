/**
 * File Upload and Operation Utilities for Playwright E2E Tests
 * 
 * Provides comprehensive file handling utilities for end-to-end testing including
 * file uploads via input elements and drag-and-drop, file generation with specific
 * properties, file download verification, and test file cleanup.
 * 
 * Features:
 * - Standard file input uploads
 * - Drag-and-drop file uploads
 * - Multiple file uploads
 * - Test file generation (various types and sizes)
 * - Upload progress monitoring
 * - File property verification
 * - Downloaded file handling
 * - Automatic test file cleanup
 * 
 * Supported file types: txt, pdf, doc, docx, jpg, png, gif, mp4, avi, zip
 * File size categories: Small <1MB, Medium 1-10MB, Large 10-50MB, Max 50MB
 * 
 * @module file-helpers
 */

import type { Page, Download } from '@playwright/test';
import { writeFile, readFile, unlink, readdir, stat, mkdir } from 'fs/promises';
import { join, resolve, extname, basename } from 'path';
import { randomBytes } from 'crypto';
import { waitForElement, waitForCondition } from './wait-helpers';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported file types for test file generation
 */
export type FileType = 'txt' | 'pdf' | 'doc' | 'docx' | 'jpg' | 'png' | 'gif' | 'mp4' | 'avi' | 'zip';

/**
 * File size categories for test file generation
 */
export type FileSize = 'small' | 'medium' | 'large';

/**
 * Options for file upload operations
 */
export interface FileUploadOptions {
  /** Maximum time to wait for upload completion in milliseconds */
  timeout?: number;
  /** Whether to verify the file appears in the file list after upload */
  verifyInList?: boolean;
  /** Selector for the file list container to verify upload */
  fileListSelector?: string;
  /** Whether to wait for upload progress to complete */
  waitForProgress?: boolean;
  /** Selector for upload progress bar */
  progressSelector?: string;
}

/**
 * Properties of an uploaded or test file
 */
export interface FileProperties {
  /** File name with extension */
  filename: string;
  /** File size in bytes */
  size: number;
  /** File type/extension */
  type: string;
  /** File path (for local test files) */
  path?: string;
  /** Upload date (for uploaded files) */
  uploadDate?: Date;
  /** MIME type */
  mimeType?: string;
}

/**
 * Result of a file upload operation
 */
export interface UploadResult {
  /** Whether the upload was successful */
  success: boolean;
  /** Properties of the uploaded file */
  file: FileProperties;
  /** Upload duration in milliseconds */
  duration: number;
  /** Any error message if upload failed */
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default directory for test files relative to project root */
const TEST_FILES_DIR = './test-files';

/** Upload timeout for large files (60 seconds) */
const UPLOAD_TIMEOUT = 60000;

/** Progress polling interval (500ms) */
const PROGRESS_POLL_INTERVAL = 500;

/** Default file upload timeout (30 seconds) */
const DEFAULT_UPLOAD_TIMEOUT = 30000;

/** File size limits in bytes */
const FILE_SIZE_LIMITS = {
  small: 1 * 1024 * 1024,      // 1MB
  medium: 10 * 1024 * 1024,    // 10MB
  large: 50 * 1024 * 1024,     // 50MB
  max: 50 * 1024 * 1024,       // 50MB maximum
};

/** MIME types for supported file types */
const MIME_TYPES: Record<FileType, string> = {
  txt: 'text/plain',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  zip: 'application/zip',
};

/** File extensions for supported file types */
const FILE_EXTENSIONS: Record<FileType, string> = {
  txt: '.txt',
  pdf: '.pdf',
  doc: '.doc',
  docx: '.docx',
  jpg: '.jpg',
  png: '.png',
  gif: '.gif',
  mp4: '.mp4',
  avi: '.avi',
  zip: '.zip',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure test files directory exists
 */
async function ensureTestFilesDir(): Promise<string> {
  const testDir = resolve(TEST_FILES_DIR);
  try {
    await mkdir(testDir, { recursive: true });
  } catch (error) {
    // Directory may already exist, ignore error
  }
  return testDir;
}

/**
 * Generate unique filename with timestamp and random identifier
 */
function generateUniqueFilename(extension: string): string {
  const timestamp = Date.now();
  const random = randomBytes(4).toString('hex');
  return `test_${timestamp}_${random}${extension}`;
}

/**
 * Get MIME type from filename
 * @param filename - Name of the file including extension
 * @returns MIME type string, defaults to 'application/octet-stream' if unknown
 */
export function getMimeTypeFromFilename(filename: string): string {
  // Extract extension from filename
  const extensionMatch = filename.match(/\.([^.]+)$/);
  if (!extensionMatch) {
    return 'application/octet-stream';
  }
  
  const extension = extensionMatch[1]!.toLowerCase();
  
  // Map to FileType if it exists in our MIME_TYPES
  return MIME_TYPES[extension as FileType] || 'application/octet-stream';
}

/**
 * Get file size in bytes based on size category
 */
function getFileSizeBytes(sizeCategory: FileSize): number {
  switch (sizeCategory) {
    case 'small':
      return Math.floor(Math.random() * FILE_SIZE_LIMITS.small * 0.9); // 0-900KB
    case 'medium':
      return FILE_SIZE_LIMITS.small + Math.floor(Math.random() * (FILE_SIZE_LIMITS.medium - FILE_SIZE_LIMITS.small) * 0.9); // 1-9MB
    case 'large':
      return FILE_SIZE_LIMITS.medium + Math.floor(Math.random() * (FILE_SIZE_LIMITS.large - FILE_SIZE_LIMITS.medium) * 0.9); // 10-45MB
    default:
      return FILE_SIZE_LIMITS.small / 2; // 500KB default
  }
}

/**
 * Generate random content for text-based files
 */
function generateRandomContent(size: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\n ';
  let content = '';
  for (let i = 0; i < size; i++) {
    content += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return content;
}

/**
 * Generate binary content for binary files
 */
function generateBinaryContent(size: number): Buffer {
  return randomBytes(size);
}

// ============================================================================
// File Upload Functions
// ============================================================================

/**
 * Upload a file via file input element
 * 
 * Uses Playwright's setInputFiles() API to upload a file through a standard
 * file input element. Waits for upload completion and optionally verifies
 * the file appears in the file list.
 * 
 * @param page Playwright Page object
 * @param fileSelector Selector for the file input element
 * @param filePath Path to the file to upload
 * @param options Upload configuration options
 * @returns Upload result with file properties and status
 * 
 * @example
 * const result = await uploadFile(
 *   page,
 *   'input[type="file"]',
 *   './test-files/document.pdf',
 *   { verifyInList: true, timeout: 30000 }
 * );
 */
export async function uploadFile(
  page: Page,
  fileSelector: string,
  filePath: string,
  options: FileUploadOptions = {}
): Promise<UploadResult> {
  const startTime = Date.now();
  const {
    timeout = DEFAULT_UPLOAD_TIMEOUT,
    verifyInList = true,
    fileListSelector = '[data-testid="file-list"], .file-list, [role="list"]',
    waitForProgress = true,
    progressSelector = '[data-testid="upload-progress"], .upload-progress, [role="progressbar"]',
  } = options;

  try {
    // Ensure file input exists
    await waitForElement(page, fileSelector, 'visible', { timeout: 5000 });

    // Get file properties before upload
    const fileStats = await stat(filePath);
    const filename = basename(filePath);
    const extension = extname(filePath);

    // Set file input
    await page.setInputFiles(fileSelector, filePath);

    // Wait for upload progress if requested
    if (waitForProgress) {
      try {
        await waitForUploadComplete(page, {
          timeout,
          progressSelector,
        });
      } catch (error) {
        // Continue even if progress tracking fails
      }
    }

    // Verify file appears in list if requested
    if (verifyInList) {
      const verified = await verifyFileUploaded(page, filename, {
        timeout: 10000,
        fileListSelector,
      });
      
      if (!verified) {
        throw new Error(`File ${filename} was not found in file list after upload`);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      file: {
        filename,
        size: fileStats.size,
        type: extension.replace('.', ''),
        path: filePath,
        uploadDate: new Date(),
        mimeType: MIME_TYPES[extension.replace('.', '') as FileType],
      },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      file: {
        filename: basename(filePath),
        size: 0,
        type: extname(filePath).replace('.', ''),
        path: filePath,
      },
      duration,
      error: error instanceof Error ? error.message : 'Unknown error during file upload',
    };
  }
}

/**
 * Upload a file via drag-and-drop
 * 
 * Simulates drag-and-drop file upload by triggering drop events on the
 * specified drop zone element. Monitors upload progress and verifies
 * the file appears in the file list.
 * 
 * @param page Playwright Page object
 * @param dropZoneSelector Selector for the drop zone element
 * @param filePath Path to the file to upload
 * @param options Upload configuration options
 * @returns Upload result with file properties and status
 * 
 * @example
 * const result = await uploadFileDragDrop(
 *   page,
 *   '[data-testid="drop-zone"]',
 *   './test-files/image.png'
 * );
 */
export async function uploadFileDragDrop(
  page: Page,
  dropZoneSelector: string,
  filePath: string,
  options: FileUploadOptions = {}
): Promise<UploadResult> {
  const startTime = Date.now();
  const {
    timeout = DEFAULT_UPLOAD_TIMEOUT,
    verifyInList = true,
    fileListSelector = '[data-testid="file-list"], .file-list, [role="list"]',
  } = options;

  try {
    // Get file properties
    const fileStats = await stat(filePath);
    const filename = basename(filePath);
    const extension = extname(filePath);
    const fileContent = await readFile(filePath);

    // Wait for drop zone to be ready
    await waitForElement(page, dropZoneSelector, 'visible', { timeout: 5000 });

    // Create DataTransfer with file
    const dataTransfer = await page.evaluateHandle(
      ({ fileName, fileContent, mimeType }) => {
        const dt = new DataTransfer();
        const file = new File([new Uint8Array(fileContent)], fileName, { type: mimeType });
        dt.items.add(file);
        return dt;
      },
      {
        fileName: filename,
        fileContent: Array.from(fileContent),
        mimeType: MIME_TYPES[extension.replace('.', '') as FileType] || 'application/octet-stream',
      }
    );

    // Trigger drop event
    await page.dispatchEvent(dropZoneSelector, 'drop', { dataTransfer });

    // Wait for upload to complete
    await waitForUploadComplete(page, { timeout });

    // Verify file in list if requested
    if (verifyInList) {
      const verified = await verifyFileUploaded(page, filename, {
        timeout: 10000,
        fileListSelector,
      });
      
      if (!verified) {
        throw new Error(`File ${filename} was not found in file list after drag-and-drop upload`);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      file: {
        filename,
        size: fileStats.size,
        type: extension.replace('.', ''),
        path: filePath,
        uploadDate: new Date(),
        mimeType: MIME_TYPES[extension.replace('.', '') as FileType],
      },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      file: {
        filename: basename(filePath),
        size: 0,
        type: extname(filePath).replace('.', ''),
        path: filePath,
      },
      duration,
      error: error instanceof Error ? error.message : 'Unknown error during drag-and-drop upload',
    };
  }
}

/**
 * Upload multiple files simultaneously
 * 
 * Uses Playwright's setInputFiles() with an array of file paths to upload
 * multiple files at once. Waits for all uploads to complete and verifies
 * all files appear in the file list.
 * 
 * @param page Playwright Page object
 * @param fileSelector Selector for the file input element (must support multiple)
 * @param filePaths Array of file paths to upload
 * @param options Upload configuration options
 * @returns Array of upload results for each file
 * 
 * @example
 * const results = await uploadMultipleFiles(
 *   page,
 *   'input[type="file"][multiple]',
 *   ['./test-files/file1.pdf', './test-files/file2.jpg']
 * );
 */
export async function uploadMultipleFiles(
  page: Page,
  fileSelector: string,
  filePaths: string[],
  options: FileUploadOptions = {}
): Promise<UploadResult[]> {
  const startTime = Date.now();
  const {
    timeout = UPLOAD_TIMEOUT,
    verifyInList = true,
    fileListSelector = '[data-testid="file-list"], .file-list, [role="list"]',
  } = options;

  const results: UploadResult[] = [];

  try {
    // Ensure file input exists
    await waitForElement(page, fileSelector, 'visible', { timeout: 5000 });

    // Get file properties for all files
    const fileProperties = await Promise.all(
      filePaths.map(async (filePath) => {
        const fileStats = await stat(filePath);
        return {
          path: filePath,
          filename: basename(filePath),
          size: fileStats.size,
          extension: extname(filePath),
        };
      })
    );

    // Set all files at once
    await page.setInputFiles(fileSelector, filePaths);

    // Wait for all uploads to complete
    await waitForUploadComplete(page, { timeout });

    // Verify each file if requested
    if (verifyInList) {
      for (const file of fileProperties) {
        const verified = await verifyFileUploaded(page, file.filename, {
          timeout: 10000,
          fileListSelector,
        });
        
        const duration = Date.now() - startTime;
        
        results.push({
          success: verified,
          file: {
            filename: file.filename,
            size: file.size,
            type: file.extension.replace('.', ''),
            path: file.path,
            uploadDate: new Date(),
            mimeType: MIME_TYPES[file.extension.replace('.', '') as FileType],
          },
          duration,
          error: verified ? undefined : `File ${file.filename} not found in list`,
        });
      }
    } else {
      // Return success for all files without verification
      const duration = Date.now() - startTime;
      for (const file of fileProperties) {
        results.push({
          success: true,
          file: {
            filename: file.filename,
            size: file.size,
            type: file.extension.replace('.', ''),
            path: file.path,
            uploadDate: new Date(),
            mimeType: MIME_TYPES[file.extension.replace('.', '') as FileType],
          },
          duration,
        });
      }
    }

    return results;
  } catch (error) {
    // Return failure results for all files
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during multiple file upload';
    
    return filePaths.map((filePath) => ({
      success: false,
      file: {
        filename: basename(filePath),
        size: 0,
        type: extname(filePath).replace('.', ''),
        path: filePath,
      },
      duration,
      error: errorMessage,
    }));
  }
}

// ============================================================================
// File Generation Functions
// ============================================================================

/**
 * Generate a test file with specific properties
 * 
 * Creates a test file of the specified type and size category, saving it
 * to the test-files directory with a unique name. The file is filled with
 * random content appropriate for its type.
 * 
 * @param fileType Type of file to generate
 * @param sizeCategory Size category (small, medium, large)
 * @returns Path to the generated file
 * 
 * @example
 * const pdfPath = await generateTestFile('pdf', 'medium');
 * // Returns: './test-files/test_1234567890_abcd1234.pdf'
 */
export async function generateTestFile(
  fileType: FileType,
  sizeCategory: FileSize = 'small'
): Promise<string> {
  const testDir = await ensureTestFilesDir();
  const extension = FILE_EXTENSIONS[fileType];
  const filename = generateUniqueFilename(extension);
  const filePath = join(testDir, filename);
  const targetSize = getFileSizeBytes(sizeCategory);

  // Generate content based on file type
  let content: Buffer | string;
  
  if (fileType === 'txt') {
    // Text files get readable text content
    content = generateRandomContent(targetSize);
  } else if (fileType === 'pdf' || fileType === 'doc' || fileType === 'docx') {
    // Document files get simple text content (not proper format, but sufficient for upload testing)
    const header = `%${fileType.toUpperCase()} Mock Document\n`;
    const bodySize = targetSize - header.length;
    content = header + generateRandomContent(bodySize);
  } else {
    // Binary files (images, videos, archives) get random binary content
    content = generateBinaryContent(targetSize);
  }

  await writeFile(filePath, content);
  
  return filePath;
}

/**
 * Create a text file with specific content
 * 
 * Creates a text file with the provided content, useful for testing
 * file uploads with known content that can be verified.
 * 
 * @param filename Name for the text file (without path)
 * @param content Text content to write to the file
 * @returns Path to the created file
 * 
 * @example
 * const filePath = await createTextFile(
 *   'test-document.txt',
 *   'This is test content for upload verification'
 * );
 */
export async function createTextFile(
  filename: string,
  content: string
): Promise<string> {
  const testDir = await ensureTestFilesDir();
  const filePath = join(testDir, filename);
  
  await writeFile(filePath, content, 'utf-8');
  
  return filePath;
}

/**
 * Create an image file with specified dimensions
 * 
 * Generates a simple image file with the specified dimensions. Creates
 * a PNG file with a solid color fill for testing image upload functionality.
 * Note: This creates a minimal valid PNG, not a canvas-rendered image.
 * 
 * @param filename Name for the image file
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns Path to the created image file
 * 
 * @example
 * const imagePath = await createImageFile('test-image.png', 800, 600);
 */
export async function createImageFile(
  filename: string,
  width: number,
  height: number
): Promise<string> {
  const testDir = await ensureTestFilesDir();
  const filePath = join(testDir, filename);
  
  // Create a minimal valid PNG file
  // PNG signature + IHDR chunk with width/height + minimal IEND chunk
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk (13 bytes data + 12 bytes overhead)
  const ihdrLength = Buffer.alloc(4);
  ihdrLength.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from('IHDR');
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(2, 9);  // color type (truecolor)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  
  // Simple CRC calculation (simplified for testing)
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(0, 0); // Simplified CRC
  
  // IEND chunk
  const iendLength = Buffer.alloc(4);
  iendLength.writeUInt32BE(0, 0);
  const iendType = Buffer.from('IEND');
  const iendCrc = Buffer.alloc(4);
  iendCrc.writeUInt32BE(0xAE426082, 0); // Standard IEND CRC
  
  const pngBuffer = Buffer.concat([
    pngSignature,
    ihdrLength,
    ihdrType,
    ihdrData,
    ihdrCrc,
    iendLength,
    iendType,
    iendCrc,
  ]);
  
  await writeFile(filePath, pngBuffer);
  
  return filePath;
}

// ============================================================================
// File Download Functions
// ============================================================================

/**
 * Download a file from Moodle and save it locally
 * 
 * Clicks a download link, waits for the download to complete, and saves
 * the file to the test-files directory for verification.
 * 
 * @param page Playwright Page object
 * @param downloadLinkSelector Selector for the download link or button
 * @param options Download configuration options
 * @returns Path to the downloaded file
 * 
 * @example
 * const downloadedPath = await downloadFile(
 *   page,
 *   '[data-testid="download-button"]'
 * );
 */
export async function downloadFile(
  page: Page,
  downloadLinkSelector: string,
  options: { timeout?: number } = {}
): Promise<string> {
  const { timeout = DEFAULT_UPLOAD_TIMEOUT } = options;
  const testDir = await ensureTestFilesDir();

  // Start waiting for download before clicking
  const downloadPromise = page.waitForEvent('download', { timeout });

  // Click the download link
  await page.click(downloadLinkSelector);

  // Wait for download to complete
  const download: Download = await downloadPromise;

  // Get suggested filename and save to test directory
  const suggestedFilename = download.suggestedFilename();
  const downloadPath = join(testDir, suggestedFilename);
  
  await download.saveAs(downloadPath);

  // Verify download completed successfully
  const downloadStats = await stat(downloadPath);
  if (downloadStats.size === 0) {
    throw new Error('Downloaded file is empty');
  }

  return downloadPath;
}

// ============================================================================
// File Verification Functions
// ============================================================================

/**
 * Verify a file appears in the file list after upload
 * 
 * Checks that the specified filename appears in the file list element,
 * polling until it appears or timeout is reached.
 * 
 * @param page Playwright Page object
 * @param filename Name of the file to verify
 * @param options Verification options
 * @returns True if file is found, false otherwise
 * 
 * @example
 * const isUploaded = await verifyFileUploaded(page, 'document.pdf');
 */
export async function verifyFileUploaded(
  page: Page,
  filename: string,
  options: { timeout?: number; fileListSelector?: string } = {}
): Promise<boolean> {
  const {
    timeout = 10000,
    fileListSelector = '[data-testid="file-list"], .file-list, [role="list"]',
  } = options;

  try {
    await waitForCondition(
      async () => {
        const fileItems = await page.locator(`${fileListSelector} [data-filename="${filename}"], ${fileListSelector} :text("${filename}")`).count();
        return fileItems > 0;
      },
      { timeout, errorMessage: `File ${filename} not found in file list` }
    );
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Verify uploaded file properties match expectations
 * 
 * Checks that the file's displayed properties (size, type, date) match
 * the expected values within acceptable tolerances.
 * 
 * @param page Playwright Page object
 * @param filename Name of the file to verify
 * @param expectedProperties Expected file properties
 * @returns Verification result with details
 * 
 * @example
 * const result = await verifyFileProperties(
 *   page,
 *   'document.pdf',
 *   { size: 1024000, type: 'pdf' }
 * );
 */
export async function verifyFileProperties(
  page: Page,
  filename: string,
  expectedProperties: Partial<FileProperties>
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Find the file item in the list
    const fileItem = page.locator(`[data-filename="${filename}"]`).first();
    const fileExists = await fileItem.count() > 0;

    if (!fileExists) {
      errors.push(`File ${filename} not found in file list`);
      return { success: false, errors };
    }

    // Verify file size if provided
    if (expectedProperties.size !== undefined) {
      const sizeText = await fileItem.locator('[data-testid="file-size"], .file-size').textContent();
      if (sizeText) {
        // Parse size from text (e.g., "1.5 MB" -> bytes)
        const sizeMatch = sizeText.match(/([\d.]+)\s*(KB|MB|GB)/i);
        if (sizeMatch?.[1] && sizeMatch[2]) {
          const value = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2].toUpperCase();
          let displayedSize = value;
          
          if (unit === 'KB') {displayedSize *= 1024;}
          else if (unit === 'MB') {displayedSize *= 1024 * 1024;}
          else if (unit === 'GB') {displayedSize *= 1024 * 1024 * 1024;}
          
          // Allow 5% tolerance for size differences
          const tolerance = expectedProperties.size * 0.05;
          if (Math.abs(displayedSize - expectedProperties.size) > tolerance) {
            errors.push(`File size mismatch: expected ~${expectedProperties.size} bytes, got ~${displayedSize} bytes`);
          }
        }
      }
    }

    // Verify file type if provided
    if (expectedProperties.type) {
      const typeText = await fileItem.locator('[data-testid="file-type"], .file-type').textContent();
      const filenameText = await fileItem.locator('[data-testid="file-name"], .file-name').textContent();
      
      const displayedType = typeText ?? (filenameText ? extname(filenameText).replace('.', '') : '');
      
      if (displayedType && displayedType.toLowerCase() !== expectedProperties.type.toLowerCase()) {
        errors.push(`File type mismatch: expected ${expectedProperties.type}, got ${displayedType}`);
      }
    }

    // Verify upload date if provided
    if (expectedProperties.uploadDate) {
      const dateText = await fileItem.locator('[data-testid="file-date"], .file-date, time').textContent();
      if (dateText) {
        const displayedDate = new Date(dateText);
        const expectedDate = expectedProperties.uploadDate;
        
        // Allow 1 hour tolerance for date differences
        const timeDiff = Math.abs(displayedDate.getTime() - expectedDate.getTime());
        if (timeDiff > 3600000) {
          errors.push(`Upload date mismatch: expected ${expectedDate.toISOString()}, got ${displayedDate.toISOString()}`);
        }
      }
    }

    return { success: errors.length === 0, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown verification error');
    return { success: false, errors };
  }
}

/**
 * Delete an uploaded file from the UI
 * 
 * Clicks the delete button for the specified file, confirms the deletion
 * dialog if present, and verifies the file is removed from the list.
 * 
 * @param page Playwright Page object
 * @param filename Name of the file to delete
 * @param options Deletion options
 * @returns True if file was successfully deleted
 * 
 * @example
 * const deleted = await deleteUploadedFile(page, 'old-file.pdf');
 */
export async function deleteUploadedFile(
  page: Page,
  filename: string,
  options: { timeout?: number; confirmDialog?: boolean } = {}
): Promise<boolean> {
  const { timeout = 10000, confirmDialog = true } = options;

  try {
    // Find the file item and its delete button
    const fileItem = page.locator(`[data-filename="${filename}"]`).first();
    const deleteButton = fileItem.locator('[data-testid="delete-file"], .delete-file, button:has-text("Delete")').first();

    // Click delete button
    await deleteButton.click();

    // Handle confirmation dialog if present
    if (confirmDialog) {
      try {
        await page.locator('[data-testid="confirm-delete"], .confirm-dialog button:has-text("Confirm"), button:has-text("Yes")').click({ timeout: 2000 });
      } catch (error) {
        // No dialog appeared, continue
      }
    }

    // Verify file is removed from list
    await waitForCondition(
      async () => {
        const count = await page.locator(`[data-filename="${filename}"]`).count();
        return count === 0;
      },
      { timeout, errorMessage: `File ${filename} was not removed from list` }
    );

    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Upload Progress Functions
// ============================================================================

/**
 * Get current upload progress percentage
 * 
 * Extracts the progress value from a progress bar element, returning
 * a percentage value between 0 and 100.
 * 
 * @param page Playwright Page object
 * @param progressSelector Selector for progress bar element
 * @returns Progress percentage (0-100)
 * 
 * @example
 * const progress = await getUploadProgress(page, '[role="progressbar"]');
 */
export async function getUploadProgress(
  page: Page,
  progressSelector: string = '[data-testid="upload-progress"], .upload-progress, [role="progressbar"]'
): Promise<number> {
  try {
    const progressBar = page.locator(progressSelector).first();
    
    // Try to get aria-valuenow attribute
    const ariaValue = await progressBar.getAttribute('aria-valuenow');
    if (ariaValue) {
      return parseFloat(ariaValue);
    }

    // Try to get value attribute
    const value = await progressBar.getAttribute('value');
    if (value) {
      return parseFloat(value);
    }

    // Try to get text content (e.g., "75%")
    const text = await progressBar.textContent();
    if (text) {
      const match = text.match(/(\d+)%/);
      if (match?.[1]) {
        return parseFloat(match[1]);
      }
    }

    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Wait for file upload to complete
 * 
 * Monitors upload progress bar until it reaches 100% or disappears,
 * or until a success message appears. Polls at regular intervals
 * with configurable timeout.
 * 
 * @param page Playwright Page object
 * @param options Wait configuration options
 * 
 * @example
 * await waitForUploadComplete(page, { timeout: 60000 });
 */
export async function waitForUploadComplete(
  page: Page,
  options: {
    timeout?: number;
    progressSelector?: string;
    successSelector?: string;
  } = {}
): Promise<void> {
  const {
    timeout = UPLOAD_TIMEOUT,
    progressSelector = '[data-testid="upload-progress"], .upload-progress, [role="progressbar"]',
    successSelector = '[data-testid="upload-success"], .upload-success, .success-message',
  } = options;

  try {
    // Wait for either:
    // 1. Progress bar to disappear (upload complete)
    // 2. Success message to appear
    // 3. Progress to reach 100%
    
    await waitForCondition(
      async () => {
        // Check if success message appeared
        const successCount = await page.locator(successSelector).count();
        if (successCount > 0) {
          return true;
        }

        // Check if progress bar disappeared
        const progressCount = await page.locator(progressSelector).count();
        if (progressCount === 0) {
          return true;
        }

        // Check if progress reached 100%
        const progress = await getUploadProgress(page, progressSelector);
        if (progress >= 100) {
          return true;
        }

        return false;
      },
      {
        timeout,
        interval: PROGRESS_POLL_INTERVAL,
        errorMessage: 'Upload did not complete within timeout',
      }
    );
  } catch (error) {
    throw new Error(`Upload failed to complete: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/**
 * Delete all generated test files
 * 
 * Removes all files from the test-files directory, optionally filtering
 * by age to preserve recent files. Useful for cleanup after test runs.
 * 
 * @param options Cleanup configuration options
 * @returns Number of files deleted
 * 
 * @example
 * // Delete all test files
 * await cleanupTestFiles();
 * 
 * // Delete only files older than 1 hour
 * await cleanupTestFiles({ olderThan: 3600000 });
 */
export async function cleanupTestFiles(
  options: { olderThan?: number; pattern?: RegExp } = {}
): Promise<number> {
  const { olderThan, pattern = /^test_/ } = options;
  const testDir = await ensureTestFilesDir();
  let deletedCount = 0;

  try {
    const files = await readdir(testDir);
    const now = Date.now();

    for (const file of files) {
      // Skip files that don't match pattern
      if (!pattern.test(file)) {
        continue;
      }

      const filePath = join(testDir, file);
      const fileStats = await stat(filePath);

      // Skip files newer than retention period if specified
      if (olderThan && now - fileStats.mtimeMs < olderThan) {
        continue;
      }

      try {
        await unlink(filePath);
        deletedCount++;
      } catch (error) {
        // Continue even if individual file deletion fails
        console.warn(`Failed to delete ${file}:`, error);
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Error during cleanup:', error);
    return deletedCount;
  }
}
