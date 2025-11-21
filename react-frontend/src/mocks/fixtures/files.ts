/**
 * E2E Test Fixtures for File Upload Testing
 * 
 * Provides sample file metadata, base64-encoded test files, file upload response objects,
 * and helper functions to generate file objects for different file types.
 * Used by assignment submission tests and file repository tests.
 * 
 * @package    react-frontend
 * @subpackage tests/e2e/fixtures
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Interface matching Moodle file API response structure
 * Mirrors the structure returned by /api/v1/files/* endpoints
 */
export interface TestFileFixture {
  /** Unique file ID from Moodle file storage */
  id: number;
  /** Original filename with extension */
  filename: string;
  /** File path within the file area (e.g., '/') */
  filepath: string;
  /** File size in bytes */
  filesize: number;
  /** MIME type of the file */
  mimetype: string;
  /** Base64-encoded file content (for test uploads) */
  content: string;
  /** Unix timestamp when file was last modified */
  timemodified: number;
  /** Author/uploader of the file */
  author: string;
  /** File license (optional) */
  license?: string;
  /** Direct URL to access the file */
  url: string;
  /** Thumbnail URL for image files (optional) */
  thumbnailurl?: string;
}

/**
 * File size constants for validation
 * Based on common Moodle file size limits
 */
export const MIN_FILE_SIZE = 1; // 1 byte minimum
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB maximum (default Moodle limit)

/**
 * MIME type constants for file validation
 * Covers common file types used in Moodle
 */
export const MIME_TYPES = {
  PDF: 'application/pdf',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  GIF: 'image/gif',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
  TXT: 'text/plain',
  MP4: 'video/mp4',
  ZIP: 'application/zip',
} as const;

/**
 * File extension constants
 */
export const FILE_EXTENSIONS = {
  PDF: '.pdf',
  JPEG: '.jpg',
  PNG: '.png',
  DOCX: '.docx',
  TXT: '.txt',
  ZIP: '.zip',
  MP4: '.mp4',
} as const;

/**
 * Sample PDF file fixture
 * Contains a minimal valid PDF structure for testing
 */
export const samplePDFFile: TestFileFixture = {
  id: 1001,
  filename: 'sample-assignment.pdf',
  filepath: '/',
  filesize: 13264,
  mimetype: MIME_TYPES.PDF,
  // Minimal valid PDF file (1 page, "Test Document" text)
  content: 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCi9SZXNvdXJjZXMgPDwvUHJvY1NldCBbL1BERiAvVGV4dF0KL0ZvbnQgPDwvRjEgNSAwIFI+Pgo+Pgo+PgplbmRvYmoKNCAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKFRlc3QgRG9jdW1lbnQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PC9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKMSAwIG9iago8PC9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbMyAwIFJdCj4+CmVuZG9iagoyIDAgb2JqCjw8L1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDEgMCBSCj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAzMDggMDAwMDAgbiAKMDAwMDAwMDM2NiAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxMjYgMDAwMDAgbiAKMDAwMDAwMDIxOCAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNgovUm9vdCAyIDAgUgo+PgpzdGFydHhyZWYKNDE1CiUlRU9G',
  timemodified: 1704067200, // 2024-01-01 00:00:00
  author: 'Test Student',
  license: 'allrightsreserved',
  url: 'https://moodle.example.com/pluginfile.php/123/mod_assign/submission/1001/sample-assignment.pdf',
};

/**
 * Sample image file fixture (PNG)
 * Contains a minimal 1x1 pixel PNG image
 */
export const sampleImageFile: TestFileFixture = {
  id: 1002,
  filename: 'profile-photo.png',
  filepath: '/',
  filesize: 68,
  mimetype: MIME_TYPES.PNG,
  // 1x1 red pixel PNG
  content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  timemodified: 1704070800, // 2024-01-01 01:00:00
  author: 'Test Student',
  url: 'https://moodle.example.com/pluginfile.php/123/user/profile/1002/profile-photo.png',
  thumbnailurl: 'https://moodle.example.com/pluginfile.php/123/user/profile/1002/thumb/profile-photo.png',
};

/**
 * Sample document file fixture (DOCX)
 * Contains a minimal valid DOCX structure
 */
export const sampleDocumentFile: TestFileFixture = {
  id: 1003,
  filename: 'essay-submission.docx',
  filepath: '/',
  filesize: 4520,
  mimetype: MIME_TYPES.DOCX,
  // Minimal DOCX file (ZIP container with minimal XML)
  content: 'UEsDBBQABgAIAAAAIQDfpNJsWgEAACAFAAATAAgCW0NvbnRlbnRfVHlwZXNdLnhtbCCiBAIooAAC',
  timemodified: 1704074400, // 2024-01-01 02:00:00
  author: 'Test Student',
  url: 'https://moodle.example.com/pluginfile.php/123/mod_assign/submission/1003/essay-submission.docx',
};

/**
 * Sample text file fixture
 * Contains plain text content
 */
export const sampleTextFile: TestFileFixture = {
  id: 1004,
  filename: 'notes.txt',
  filepath: '/',
  filesize: 256,
  mimetype: MIME_TYPES.TXT,
  // Base64 encoded "This is a test text file for E2E testing.\nIt contains multiple lines.\nLine 3\nLine 4"
  content: 'VGhpcyBpcyBhIHRlc3QgdGV4dCBmaWxlIGZvciBFMkUgdGVzdGluZy4KSXQgY29udGFpbnMgbXVsdGlwbGUgbGluZXMuCkxpbmUgMwpMaW5lIDQ=',
  timemodified: 1704078000, // 2024-01-01 03:00:00
  author: 'Test Student',
  url: 'https://moodle.example.com/pluginfile.php/123/mod_forum/attachment/1004/notes.txt',
};

/**
 * Sample video file fixture (MP4)
 * Represents a video file for testing multimedia uploads
 */
export const sampleVideoFile: TestFileFixture = {
  id: 1005,
  filename: 'presentation-recording.mp4',
  filepath: '/',
  filesize: 15728640, // 15 MB
  mimetype: MIME_TYPES.MP4,
  // Minimal MP4 header (not a valid playable video, just for structure testing)
  content: 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAACKBtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjc0MyA1Yj==',
  timemodified: 1704081600, // 2024-01-01 04:00:00
  author: 'Test Teacher',
  url: 'https://moodle.example.com/pluginfile.php/123/mod_resource/content/1005/presentation-recording.mp4',
};

/**
 * Sample ZIP archive file fixture
 * Represents a compressed archive for bulk file uploads
 */
export const sampleZipFile: TestFileFixture = {
  id: 1006,
  filename: 'project-files.zip',
  filepath: '/',
  filesize: 8192,
  mimetype: MIME_TYPES.ZIP,
  // Minimal valid ZIP file with one text file entry
  content: 'UEsDBBQAAAAIAAAAAACBQGM7CgAAAAgAAAAIAAAAdGVzdC50eHR75/LySQQAAP//UEsBAj8AFAAAAAgAAAAAAIFAYzsKAAAACAAAAAgAAAAAAAAAAAAAQAAAAAAAAAB0ZXN0LnR4dFBLBQYAAAAAAQABADYAAAAwAAAAAAA=',
  timemodified: 1704085200, // 2024-01-01 05:00:00
  author: 'Test Student',
  url: 'https://moodle.example.com/pluginfile.php/123/mod_assign/submission/1006/project-files.zip',
};

/**
 * Sample large file fixture
 * Used to test file size limit validation (simulates a 50MB file)
 */
export const sampleLargeFile: TestFileFixture = {
  id: 1007,
  filename: 'large-dataset.csv',
  filepath: '/',
  filesize: 52428800, // 50 MB
  mimetype: 'text/csv',
  // Small base64 string (actual content not important for size testing)
  content: 'TmFtZSxBZ2UsQ2l0eQpKb2huLDMwLE5ldyBZb3JrCkphbmUsMjUsU2FuIEZyYW5jaXNjbwo=',
  timemodified: 1704088800, // 2024-01-01 06:00:00
  author: 'Test Researcher',
  url: 'https://moodle.example.com/pluginfile.php/123/mod_data/content/1007/large-dataset.csv',
};

/**
 * Helper function to create a File object from base64 content
 * Converts test fixture data into browser File objects for upload simulation
 * 
 * @param fixture - Test file fixture containing base64 content
 * @returns Browser File object ready for upload
 */
export function createTestFile(fixture: TestFileFixture): File {
  // Decode base64 content to binary
  const binaryString = atob(fixture.content);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create Blob from binary data
  const blob = new Blob([bytes], { type: fixture.mimetype });
  
  // Create File object (extends Blob with name and lastModified)
  const file = new File([blob], fixture.filename, {
    type: fixture.mimetype,
    lastModified: fixture.timemodified * 1000, // Convert to milliseconds
  });
  
  return file;
}

/**
 * Helper function to create a mock file upload API response
 * Simulates successful file upload response from Moodle API
 * 
 * @param fixture - Test file fixture
 * @param contextId - Context ID where file is uploaded (default: 123)
 * @param component - Moodle component (default: 'mod_assign')
 * @param filearea - File area within component (default: 'submission')
 * @returns Mock API response object
 */
export function createFileUploadResponse(
  fixture: TestFileFixture,
  contextId: number = 123,
  component: string = 'mod_assign',
  filearea: string = 'submission'
) {
  return {
    success: true,
    data: {
      file: {
        id: fixture.id,
        filename: fixture.filename,
        filepath: fixture.filepath,
        filesize: fixture.filesize,
        mimetype: fixture.mimetype,
        timemodified: fixture.timemodified,
        author: fixture.author,
        license: fixture.license,
        url: fixture.url,
        thumbnailurl: fixture.thumbnailurl,
      },
      contextid: contextId,
      component,
      filearea,
      itemid: fixture.id,
    },
    meta: {
      uploadedAt: new Date().toISOString(),
    },
  };
}

/**
 * Helper function to create FormData for file upload
 * Prepares file data in the format expected by Moodle's file upload API
 * 
 * @param file - File object to upload
 * @param itemId - Item ID for the file area (default: 0 for new items)
 * @param filepath - Target file path (default: '/')
 * @returns FormData object ready for API submission
 */
export function createFileUploadData(
  file: File,
  itemId: number = 0,
  filepath: string = '/'
): FormData {
  const formData = new FormData();
  
  // Add file
  formData.append('file', file);
  
  // Add metadata
  formData.append('itemid', itemId.toString());
  formData.append('filepath', filepath);
  formData.append('filename', file.name);
  
  // Add optional repository parameters (for draft file uploads)
  formData.append('repo_id', '0');
  formData.append('repo_upload_file', file.name);
  formData.append('author', 'Test User');
  formData.append('license', 'allrightsreserved');
  
  return formData;
}

/**
 * Collection of all sample files for easy iteration in tests
 */
export const allSampleFiles = [
  samplePDFFile,
  sampleImageFile,
  sampleDocumentFile,
  sampleTextFile,
  sampleVideoFile,
  sampleZipFile,
] as const;

/**
 * File fixtures organized by category for specific test scenarios
 */
export const filesByCategory = {
  documents: [samplePDFFile, sampleDocumentFile, sampleTextFile],
  images: [sampleImageFile],
  media: [sampleVideoFile],
  archives: [sampleZipFile],
  large: [sampleLargeFile],
} as const;
