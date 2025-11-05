/**
 * File Upload Testing Utilities
 * 
 * Comprehensive utilities for testing file upload interactions including:
 * - Mock File and FileList creation
 * - File input and drag-and-drop event simulation
 * - File validation helpers
 * - Upload progress and outcome mocking
 * 
 * @module tests/helpers/fileUtils
 */

import { expect } from 'vitest';

/**
 * Options for creating a mock file
 */
interface MockFileOptions {
  name?: string;
  size?: number;
  type?: string;
  content?: string;
  lastModified?: number;
}

/**
 * Creates a mock File object with customizable properties
 * 
 * @example
 * const file = createMockFile({ name: 'test.pdf', size: 1024, type: 'application/pdf' });
 * 
 * @param options - Configuration options for the mock file
 * @returns A File object
 */
export function createMockFile(options: MockFileOptions = {}): File {
  const {
    name = 'test-file.txt',
    size = 1024,
    type = 'text/plain',
    content = 'Mock file content',
    lastModified = Date.now(),
  } = options;

  // Create a Blob with the specified content and type
  const blob = new Blob([content], { type });
  
  // Create a File from the Blob
  const file = new File([blob], name, {
    type,
    lastModified,
  });

  // Override size if specified (File API doesn't let us set size directly)
  if (size !== blob.size) {
    Object.defineProperty(file, 'size', {
      value: size,
      writable: false,
      configurable: true,
    });
  }

  return file;
}

/**
 * Creates a mock PDF file
 * 
 * @example
 * const pdf = createMockPDFFile('assignment.pdf', 500);
 * 
 * @param name - File name (default: 'document.pdf')
 * @param sizeKB - File size in kilobytes (default: 100)
 * @returns A File object with PDF MIME type
 */
export function createMockPDFFile(name = 'document.pdf', sizeKB = 100): File {
  const content = '%PDF-1.4\n%Mock PDF content\n'.repeat(Math.ceil(sizeKB / 2));
  return createMockFile({
    name,
    type: 'application/pdf',
    content,
    size: sizeKB * 1024,
  });
}

/**
 * Creates a mock image file
 * 
 * @example
 * const image = createMockImageFile('photo.jpg', 'jpg', 200);
 * 
 * @param name - File name (default: 'image.jpg')
 * @param type - Image type: 'jpg', 'png', or 'gif' (default: 'jpg')
 * @param sizeKB - File size in kilobytes (default: 50)
 * @returns A File object with image MIME type
 */
export function createMockImageFile(
  name = 'image.jpg',
  type: 'jpg' | 'png' | 'gif' = 'jpg',
  sizeKB = 50
): File {
  const mimeTypes = {
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
  };

  // Create mock binary image data
  const content = new Array(sizeKB).fill('MOCK_IMAGE_DATA_').join('');

  return createMockFile({
    name,
    type: mimeTypes[type],
    content,
    size: sizeKB * 1024,
  });
}

/**
 * Creates a mock document file
 * 
 * @example
 * const doc = createMockDocumentFile('essay.docx', 'docx', 150);
 * 
 * @param name - File name (default: 'document.doc')
 * @param type - Document type: 'doc', 'docx', or 'txt' (default: 'docx')
 * @param sizeKB - File size in kilobytes (default: 100)
 * @returns A File object with document MIME type
 */
export function createMockDocumentFile(
  name = 'document.docx',
  type: 'doc' | 'docx' | 'txt' = 'docx',
  sizeKB = 100
): File {
  const mimeTypes = {
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };

  const content = 'Mock document content. '.repeat(Math.ceil(sizeKB * 50));

  return createMockFile({
    name,
    type: mimeTypes[type],
    content,
    size: sizeKB * 1024,
  });
}

/**
 * Creates a mock video file
 * 
 * @example
 * const video = createMockVideoFile('lecture.mp4', 5000);
 * 
 * @param name - File name (default: 'video.mp4')
 * @param sizeKB - File size in kilobytes (default: 1000)
 * @returns A File object with video MIME type
 */
export function createMockVideoFile(name = 'video.mp4', sizeKB = 1000): File {
  const content = 'MOCK_VIDEO_DATA_'.repeat(Math.ceil(sizeKB * 64));

  return createMockFile({
    name,
    type: 'video/mp4',
    content,
    size: sizeKB * 1024,
  });
}

/**
 * Creates a large file for testing file size limits
 * 
 * @example
 * const largeFile = createLargeFile(50); // 50MB file
 * 
 * @param sizeMB - File size in megabytes
 * @returns A File object of the specified size
 */
export function createLargeFile(sizeMB: number): File {
  const sizeBytes = sizeMB * 1024 * 1024;
  const content = 'X'.repeat(Math.min(sizeBytes, 10000)); // Limit actual content size

  return createMockFile({
    name: `large-file-${sizeMB}MB.bin`,
    type: 'application/octet-stream',
    content,
    size: sizeBytes,
  });
}

/**
 * Creates a mock FileList from an array of File objects
 * 
 * @example
 * const files = [file1, file2, file3];
 * const fileList = createMockFileList(files);
 * 
 * @param files - Array of File objects
 * @returns A FileList-like object
 */
export function createMockFileList(files: File[]): FileList {
  const fileList: Partial<FileList> & { [index: number]: File } = {
    length: files.length,
    item: (index: number) => files[index] || null,
  };

  // Add indexed properties
  files.forEach((file, index) => {
    fileList[index] = file;
  });

  // Add iterator support
  fileList[Symbol.iterator] = function* (): Generator<File, undefined, unknown> {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        yield file;
      }
    }
    return undefined;
  };

  return fileList as FileList;
}

/**
 * Creates a FileList with a single file
 * 
 * @example
 * const fileList = createSingleFileList(mockFile);
 * 
 * @param file - The File object
 * @returns A FileList containing one file
 */
export function createSingleFileList(file: File): FileList {
  return createMockFileList([file]);
}

/**
 * Creates a FileList with multiple mock files
 * 
 * @example
 * const fileList = createMultiFileList(5); // Creates 5 mock files
 * 
 * @param count - Number of files to create
 * @returns A FileList with the specified number of files
 */
export function createMultiFileList(count: number): FileList {
  const files = Array.from({ length: count }, (_, i) => 
    createMockFile({
      name: `file-${i + 1}.txt`,
      content: `Content of file ${i + 1}`,
    })
  );
  return createMockFileList(files);
}

/**
 * Simulates file selection on an input element
 * 
 * @example
 * const input = document.querySelector('input[type="file"]');
 * simulateFileSelect(input, mockFile);
 * 
 * @param input - The file input element
 * @param files - Single file or array of files to select
 */
export function simulateFileSelect(
  input: HTMLInputElement,
  files: File | File[]
): void {
  const fileArray = Array.isArray(files) ? files : [files];
  const fileList = createMockFileList(fileArray);

  // Set the files property
  Object.defineProperty(input, 'files', {
    value: fileList,
    writable: false,
    configurable: true,
  });

  // Dispatch change event
  const changeEvent = new Event('change', { bubbles: true });
  input.dispatchEvent(changeEvent);
}

/**
 * Simulates file drop on an element
 * 
 * @example
 * const dropZone = document.querySelector('.drop-zone');
 * simulateFileDrop(dropZone, [file1, file2]);
 * 
 * @param element - The element to drop files on
 * @param files - Single file or array of files to drop
 */
export function simulateFileDrop(
  element: HTMLElement,
  files: File | File[]
): void {
  const fileArray = Array.isArray(files) ? files : [files];
  
  // Create drag event with files
  const dropEvent = createDragEvent('drop', fileArray);
  element.dispatchEvent(dropEvent);
}

/**
 * Creates a file change event
 * 
 * @example
 * const event = createFileChangeEvent([mockFile]);
 * 
 * @param files - Array of files
 * @returns A change Event with files attached
 */
export function createFileChangeEvent(files: File[]): Event {
  const event = new Event('change', { bubbles: true });
  const fileList = createMockFileList(files);
  
  Object.defineProperty(event, 'target', {
    value: { files: fileList },
    writable: false,
  });

  return event;
}

/**
 * Creates a drag event with files
 * 
 * @example
 * const event = createDragEvent('drop', [file1, file2]);
 * 
 * @param type - The drag event type
 * @param files - Array of files to attach
 * @returns A DragEvent with files in dataTransfer
 */
export function createDragEvent(
  type: 'dragenter' | 'dragover' | 'drop',
  files: File[]
): DragEvent {
  // jsdom doesn't implement DragEvent, so we use MouseEvent as a fallback
  // DragEvent extends MouseEvent in the browser, so this is a reasonable polyfill
  let event: DragEvent;
  
  if (typeof DragEvent !== 'undefined') {
    event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
    });
  } else {
    // Fallback for jsdom: create MouseEvent and cast it
    event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
    }) as unknown as DragEvent;
  }

  const fileList = createMockFileList(files);

  // Mock DataTransfer object
  const dataTransfer = {
    files: fileList,
    items: files.map((file) => ({
      kind: 'file' as const,
      type: file.type,
      getAsFile: () => file,
    })),
    types: ['Files'],
    dropEffect: 'copy' as const,
    effectAllowed: 'all' as const,
    clearData: () => {},
    getData: () => '',
    setData: () => {},
    setDragImage: () => {},
  };

  Object.defineProperty(event, 'dataTransfer', {
    value: dataTransfer,
    writable: false,
  });

  return event;
}

/**
 * Asserts that a file has the expected type
 * 
 * @example
 * expectFileType(file, 'application/pdf');
 * 
 * @param file - The file to check
 * @param expectedType - The expected MIME type
 * @throws Assertion error if types don't match
 */
export function expectFileType(file: File, expectedType: string): void {
  expect(file.type).toBe(expectedType);
}

/**
 * Asserts that a file is within the maximum size
 * 
 * @example
 * expectFileSize(file, 5 * 1024 * 1024); // 5MB max
 * 
 * @param file - The file to check
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @throws Assertion error if file exceeds size
 */
export function expectFileSize(file: File, maxSizeBytes: number): void {
  expect(file.size).toBeLessThanOrEqual(maxSizeBytes);
  expect(file.size).toBeGreaterThan(0);
}

/**
 * Asserts that a file name matches the expected pattern
 * 
 * @example
 * expectValidFileName(file, /^[a-z0-9-]+\.(pdf|docx)$/i);
 * 
 * @param file - The file to check
 * @param pattern - Optional regex pattern (default: any non-empty name)
 * @throws Assertion error if name is invalid
 */
export function expectValidFileName(file: File, pattern?: RegExp): void {
  expect(file.name).toBeTruthy();
  
  if (pattern) {
    expect(file.name).toMatch(pattern);
  }
}

/**
 * Checks if a file type is in the allowed list
 * 
 * @example
 * const isAllowed = isAllowedFileType(file, ['application/pdf', 'image/jpeg']);
 * 
 * @param file - The file to check
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if file type is allowed
 */
export function isAllowedFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Checks if a file size is within the maximum limit
 * 
 * @example
 * const isValid = isFileSizeValid(file, 10); // 10MB max
 * 
 * @param file - The file to check
 * @param maxSizeMB - Maximum size in megabytes
 * @returns True if file size is valid
 */
export function isFileSizeValid(file: File, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size > 0 && file.size <= maxSizeBytes;
}

/**
 * Mocks file upload progress over time
 * 
 * @example
 * mockFileUploadProgress((progress) => console.log(`${progress}%`), 2000);
 * 
 * @param onProgress - Callback receiving progress percentage (0-100)
 * @param duration - Total upload duration in milliseconds (default: 1000)
 */
export function mockFileUploadProgress(
  onProgress: (progress: number) => void,
  duration = 1000
): void {
  const steps = 10;
  const interval = duration / steps;

  let currentStep = 0;

  const timer = setInterval(() => {
    currentStep++;
    const progress = Math.min((currentStep / steps) * 100, 100);
    onProgress(progress);

    if (currentStep >= steps) {
      clearInterval(timer);
    }
  }, interval);
}

/**
 * Mocks a successful file upload with delay
 * 
 * @example
 * const result = await mockFileUploadSuccess(file, 500);
 * console.log(result.id, result.url);
 * 
 * @param file - The file being uploaded
 * @param delay - Delay before resolving in milliseconds (default: 500)
 * @returns Promise resolving to upload result with id and url
 */
export function mockFileUploadSuccess(
  file: File,
  delay = 500
): Promise<{ id: string; url: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: `https://example.com/uploads/${encodeURIComponent(file.name)}`,
      });
    }, delay);
  });
}

/**
 * Mocks a failed file upload with delay
 * 
 * @example
 * try {
 *   await mockFileUploadError('File too large', 300);
 * } catch (error) {
 *   console.error(error);
 * }
 * 
 * @param error - Error message
 * @param delay - Delay before rejecting in milliseconds (default: 500)
 * @returns Promise that rejects with the error
 */
export function mockFileUploadError(
  error: string,
  delay = 500
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(error));
    }, delay);
  });
}

/**
 * Creates a typical assignment submission file
 * 
 * @example
 * const submissionFile = createAssignmentSubmissionFile();
 * 
 * @returns A File suitable for assignment submission testing
 */
export function createAssignmentSubmissionFile(): File {
  return createMockPDFFile('assignment-submission.pdf', 250);
}

/**
 * Creates a typical profile avatar image file
 * 
 * @example
 * const avatar = createProfileAvatarFile();
 * 
 * @returns A File suitable for profile picture testing
 */
export function createProfileAvatarFile(): File {
  return createMockImageFile('avatar.jpg', 'jpg', 100);
}

/**
 * Creates an invalid file (exceeds limits or wrong type)
 * 
 * @example
 * const invalidFile = createInvalidFile();
 * 
 * @returns A File that should fail validation
 */
export function createInvalidFile(): File {
  // Create a file that's too large (100MB) with an uncommon type
  return createMockFile({
    name: 'invalid-file.xyz',
    type: 'application/x-unknown',
    size: 100 * 1024 * 1024,
    content: 'Invalid content',
  });
}

/**
 * Creates multiple submission files for testing
 * 
 * @example
 * const files = createMultipleSubmissionFiles(3);
 * 
 * @param count - Number of submission files to create
 * @returns Array of File objects suitable for submission testing
 */
export function createMultipleSubmissionFiles(count: number): File[] {
  const fileTypes = [
    { ext: 'pdf', creator: () => createMockPDFFile(`submission-${Date.now()}.pdf`, 200) },
    { ext: 'docx', creator: () => createMockDocumentFile(`essay-${Date.now()}.docx`, 'docx', 150) },
    { ext: 'jpg', creator: () => createMockImageFile(`diagram-${Date.now()}.jpg`, 'jpg', 75) },
  ];

  return Array.from({ length: count }, (_, i) => {
    const type = fileTypes[i % fileTypes.length]!;
    return type.creator();
  });
}

/**
 * Creates a file with specific text content
 * 
 * @example
 * const file = createFileWithContent('Hello World', 'greeting.txt', 'text/plain');
 * 
 * @param content - The text content of the file
 * @param filename - The file name
 * @param type - The MIME type
 * @returns A File with the specified content
 */
export function createFileWithContent(
  content: string,
  filename: string,
  type: string
): File {
  return createMockFile({
    name: filename,
    type,
    content,
    size: new Blob([content]).size,
  });
}

/**
 * Reads the content of a mock file
 * 
 * @example
 * const content = await readMockFileContent(mockFile);
 * expect(content).toContain('expected text');
 * 
 * @param file - The file to read
 * @returns Promise resolving to the file's text content
 */
export function readMockFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('FileReader error'));
    };
    
    reader.readAsText(file);
  });
}
