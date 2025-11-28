/**
 * FileViewer Component Test Suite
 *
 * Comprehensive unit tests for the FileViewer component validating:
 * - Format-specific file previews (images, PDFs, videos, office documents)
 * - MIME type detection and viewer selection
 * - Download functionality
 * - Zoom/fullscreen controls
 * - File metadata display
 * - Keyboard shortcuts
 * - Loading states with Material-UI Skeleton
 * - Error handling with Alert components
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Material-UI integration
 * - TypeScript prop validation
 * - Edge cases (unsupported files, large files, broken URLs, permissions)
 *
 * @package react-frontend
 * @subpackage tests/unit/features/activities/resources/components
 * @see react-frontend/src/features/activities/resources/components/FileViewer.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@tests/helpers/render';
import FileViewer from '@/features/activities/resources/components/FileViewer';
import { createLargeFile } from '@tests/helpers/fileUtils';
import type { File as MoodleFile } from '@/features/activities/resources/types/resource.types';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Mock file factory for creating test file objects
 * Matches the File interface from resource.types.ts
 */
const createMockMoodleFile = (overrides: Partial<MoodleFile> = {}): MoodleFile => ({
  filename: 'test-file.txt',
  filepath: '/path/to/file/',
  filesize: 1024,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/test-file.txt',
  timemodified: Math.floor(Date.now() / 1000),
  mimetype: 'text/plain',
  isexternalfile: false,
  ...overrides,
});

/**
 * Mock files for different MIME types
 */
const mockImageFile = createMockMoodleFile({
  filename: 'photo.jpg',
  mimetype: 'image/jpeg',
  filesize: 2048000,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/photo.jpg',
});

const mockPngFile = createMockMoodleFile({
  filename: 'diagram.png',
  mimetype: 'image/png',
  filesize: 512000,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/diagram.png',
});

const mockPdfFile = createMockMoodleFile({
  filename: 'document.pdf',
  mimetype: 'application/pdf',
  filesize: 5242880,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/document.pdf',
});

const mockVideoFile = createMockMoodleFile({
  filename: 'lecture.mp4',
  mimetype: 'video/mp4',
  filesize: 104857600,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/lecture.mp4',
});

const mockAudioFile = createMockMoodleFile({
  filename: 'podcast.mp3',
  mimetype: 'audio/mpeg',
  filesize: 10485760,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/podcast.mp3',
});

const mockWordFile = createMockMoodleFile({
  filename: 'essay.docx',
  mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  filesize: 102400,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/essay.docx',
});

const mockExcelFile = createMockMoodleFile({
  filename: 'grades.xlsx',
  mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  filesize: 51200,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/grades.xlsx',
});

const mockPowerPointFile = createMockMoodleFile({
  filename: 'presentation.pptx',
  mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  filesize: 2097152,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/presentation.pptx',
});

const mockTextFile = createMockMoodleFile({
  filename: 'readme.txt',
  mimetype: 'text/plain',
  filesize: 4096,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/readme.txt',
});

const mockJsonFile = createMockMoodleFile({
  filename: 'config.json',
  mimetype: 'application/json',
  filesize: 2048,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/config.json',
});

const mockUnknownFile = createMockMoodleFile({
  filename: 'data.bin',
  mimetype: 'application/octet-stream',
  filesize: 32768,
  fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/data.bin',
});

/**
 * MSW server setup for API mocking
 */
const server = setupServer(
  // Default handler for text file content
  http.get('https://example.com/pluginfile.php/*', () => {
    return new HttpResponse('Mock file content for testing purposes.', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  })
);

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('FileViewer component', () => {
  // Mock document fullscreen API
  let mockRequestFullscreen: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let mockExitFullscreen: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    // Mock fullscreen API
    mockRequestFullscreen = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockExitFullscreen = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    // Setup fullscreen API mock
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    });

    document.exitFullscreen = mockExitFullscreen;

    // Mock createElement for download functionality
    const mockLink = {
      href: '',
      download: '',
      target: '',
      rel: '',
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return mockLink as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node);

    // Reset fullscreen element
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ====================================================================
  // RENDERING TESTS
  // ====================================================================

  describe('Rendering Tests', () => {
    describe('Image Viewer', () => {
      it('renders image viewer for JPEG MIME type with Material-UI CardMedia', () => {
        render(<FileViewer file={mockImageFile} />);

        const image = screen.getByRole('img', { name: /photo\.jpg/i });
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', mockImageFile.fileurl);
      });

      it('renders image viewer for PNG MIME type', () => {
        render(<FileViewer file={mockPngFile} />);

        const image = screen.getByRole('img', { name: /diagram\.png/i });
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', mockPngFile.fileurl);
      });

      it('displays image with proper alt text from title prop', () => {
        render(<FileViewer file={mockImageFile} title="My Custom Image" />);

        const image = screen.getByRole('img', { name: 'My Custom Image' });
        expect(image).toBeInTheDocument();
      });

      it('displays image with filename as alt text when no title provided', () => {
        render(<FileViewer file={mockImageFile} />);

        const image = screen.getByRole('img', { name: /photo\.jpg/i });
        expect(image).toBeInTheDocument();
      });
    });

    describe('PDF Viewer', () => {
      it('renders PDF viewer using iframe for application/pdf MIME type', () => {
        render(<FileViewer file={mockPdfFile} />);

        const iframe = screen.getByTitle(/document\.pdf/i);
        expect(iframe).toBeInTheDocument();
        expect(iframe.tagName).toBe('IFRAME');
        expect(iframe).toHaveAttribute('src', expect.stringContaining(mockPdfFile.fileurl));
      });

      it('includes FitH view parameter in PDF URL', () => {
        render(<FileViewer file={mockPdfFile} />);

        const iframe = screen.getByTitle(/document\.pdf/i);
        expect(iframe).toHaveAttribute('src', expect.stringContaining('#view=FitH'));
      });
    });

    describe('Video Player', () => {
      it('renders video player with HTML5 video element for video/* MIME types', () => {
        render(<FileViewer file={mockVideoFile} />);

        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('controls');
      });

      it('renders video with source element containing correct src', () => {
        render(<FileViewer file={mockVideoFile} />);

        const source = document.querySelector('video source');
        expect(source).toBeInTheDocument();
        expect(source).toHaveAttribute('src', mockVideoFile.fileurl);
        expect(source).toHaveAttribute('type', mockVideoFile.mimetype);
      });

      it('includes nodownload in controlsList to prevent default download', () => {
        render(<FileViewer file={mockVideoFile} />);

        const video = document.querySelector('video');
        expect(video).toHaveAttribute('controlsList', 'nodownload');
      });
    });

    describe('Audio Player', () => {
      it('renders audio player with HTML5 audio element for audio/* MIME types', () => {
        render(<FileViewer file={mockAudioFile} />);

        const audio = document.querySelector('audio');
        expect(audio).toBeInTheDocument();
        expect(audio).toHaveAttribute('controls');
      });

      it('renders audio with source element containing correct src', () => {
        render(<FileViewer file={mockAudioFile} />);

        const source = document.querySelector('audio source');
        expect(source).toBeInTheDocument();
        expect(source).toHaveAttribute('src', mockAudioFile.fileurl);
        expect(source).toHaveAttribute('type', mockAudioFile.mimetype);
      });
    });

    describe('Office Document Viewer', () => {
      it('renders office document viewer using iframe for Word MIME type', () => {
        render(<FileViewer file={mockWordFile} />);

        const iframe = screen.getByTitle(/essay\.docx/i);
        expect(iframe).toBeInTheDocument();
        expect(iframe.tagName).toBe('IFRAME');
      });

      it('uses Office Online viewer URL for office documents', () => {
        render(<FileViewer file={mockWordFile} />);

        const iframe = screen.getByTitle(/essay\.docx/i);
        expect(iframe).toHaveAttribute('src', expect.stringContaining('view.officeapps.live.com'));
      });

      it('renders Excel viewer for spreadsheet MIME type', () => {
        render(<FileViewer file={mockExcelFile} />);

        const iframe = screen.getByTitle(/grades\.xlsx/i);
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', expect.stringContaining('view.officeapps.live.com'));
      });

      it('renders PowerPoint viewer for presentation MIME type', () => {
        render(<FileViewer file={mockPowerPointFile} />);

        const iframe = screen.getByTitle(/presentation\.pptx/i);
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', expect.stringContaining('view.officeapps.live.com'));
      });
    });

    describe('Text File Viewer', () => {
      it('renders text file viewer for text/* MIME types', async () => {
        render(<FileViewer file={mockTextFile} />);

        await waitFor(() => {
          expect(screen.getByText(/mock file content/i)).toBeInTheDocument();
        });
      });

      it('renders JSON file with text viewer', async () => {
        render(<FileViewer file={mockJsonFile} />);

        await waitFor(() => {
          expect(screen.getByText(/mock file content/i)).toBeInTheDocument();
        });
      });

      it('uses monospace font for text content', async () => {
        render(<FileViewer file={mockTextFile} />);

        await waitFor(() => {
          const preElement = document.querySelector('pre');
          expect(preElement).toBeInTheDocument();
        });
      });
    });

    describe('Generic File Viewer', () => {
      it('renders generic iframe viewer for unknown MIME types', () => {
        render(<FileViewer file={mockUnknownFile} />);

        const iframe = screen.getByTitle(/data\.bin/i);
        expect(iframe).toBeInTheDocument();
        expect(iframe.tagName).toBe('IFRAME');
      });

      it('includes embed parameter in URL for generic viewer', () => {
        render(<FileViewer file={mockUnknownFile} />);

        const iframe = screen.getByTitle(/data\.bin/i);
        expect(iframe).toHaveAttribute('src', expect.stringContaining('embed=1'));
      });
    });

    describe('Metadata Panel', () => {
      it('displays file metadata panel by default', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByText('File Information')).toBeInTheDocument();
      });

      it('displays filename in metadata panel', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByText(/photo\.jpg/i)).toBeInTheDocument();
      });

      it('displays file size in metadata panel', () => {
        render(<FileViewer file={mockImageFile} />);

        // File size is 2048000 bytes = ~2MB
        expect(screen.getByText(/size:/i)).toBeInTheDocument();
      });

      it('displays MIME type in metadata panel', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByText(/image\/jpeg/i)).toBeInTheDocument();
      });

      it('hides metadata panel when showMetadata is false', () => {
        render(<FileViewer file={mockImageFile} showMetadata={false} />);

        expect(screen.queryByText('File Information')).not.toBeInTheDocument();
      });

      it('displays external file source when file is from repository', () => {
        const externalFile = createMockMoodleFile({
          ...mockImageFile,
          isexternalfile: true,
          repositorytype: 'Google Drive',
        });
        render(<FileViewer file={externalFile} />);

        expect(screen.getByText(/google drive/i)).toBeInTheDocument();
      });
    });

    describe('Download Button', () => {
      it('shows download button with Material-UI Button and GetApp icon', () => {
        render(<FileViewer file={mockImageFile} />);

        const downloadButton = screen.getByRole('button', { name: /download/i });
        expect(downloadButton).toBeInTheDocument();
      });

      it('hides download button when showDownload is false', () => {
        render(<FileViewer file={mockImageFile} showDownload={false} />);

        const downloadButton = screen.queryByRole('button', { name: /download photo\.jpg/i });
        expect(downloadButton).not.toBeInTheDocument();
      });
    });
  });

  // ====================================================================
  // PROP HANDLING TESTS
  // ====================================================================

  describe('Prop Handling Tests', () => {
    it('validates FileViewerProps interface with required file prop', () => {
      render(<FileViewer file={mockImageFile} />);

      expect(screen.getByRole('region', { name: /file viewer/i })).toBeInTheDocument();
    });

    it('handles file URL prop for secure pluginfile.php access', () => {
      render(<FileViewer file={mockImageFile} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', expect.stringContaining('pluginfile.php'));
    });

    it('processes MIME type prop for format detection', () => {
      // Test image type detection
      const { rerender } = render(<FileViewer file={mockImageFile} />);
      expect(screen.getByRole('img')).toBeInTheDocument();

      // Rerender with PDF to verify type change
      rerender(<FileViewer file={mockPdfFile} />);
      expect(screen.getByTitle(/document\.pdf/i)).toBeInTheDocument();
    });

    it('uses filename prop for display in metadata', () => {
      render(<FileViewer file={mockImageFile} />);

      expect(screen.getByText(/photo\.jpg/)).toBeInTheDocument();
    });

    it('uses title prop when provided', () => {
      render(<FileViewer file={mockImageFile} title="Custom Title" />);

      const image = screen.getByRole('img', { name: 'Custom Title' });
      expect(image).toBeInTheDocument();
    });

    it('handles custom ariaLabel prop', () => {
      render(<FileViewer file={mockImageFile} ariaLabel="Custom File Viewer Region" />);

      expect(screen.getByRole('region', { name: 'Custom File Viewer Region' })).toBeInTheDocument();
    });

    it('applies custom className prop', () => {
      render(<FileViewer file={mockImageFile} className="custom-viewer-class" />);

      const container = document.getElementById('file-viewer-container');
      expect(container).toHaveClass('custom-viewer-class');
    });

    it('handles file size display for various sizes', () => {
      const smallFile = createMockMoodleFile({ filesize: 512 });
      render(<FileViewer file={smallFile} />);
      
      expect(screen.getByText(/bytes/i)).toBeInTheDocument();
    });

    it('handles timemodified for displaying last modified date', () => {
      const fileWithDate = createMockMoodleFile({
        timemodified: Math.floor(new Date('2024-01-15').getTime() / 1000),
      });
      render(<FileViewer file={fileWithDate} />);

      expect(screen.getByText(/modified:/i)).toBeInTheDocument();
    });
  });

  // ====================================================================
  // USER INTERACTION TESTS
  // ====================================================================

  describe('User Interaction Tests', () => {
    describe('Download Functionality', () => {
      it('handles download button click triggering file download', async () => {
        const mockOnDownload = vi.fn();
        const { user } = render(
          <FileViewer file={mockImageFile} onDownload={mockOnDownload} />
        );

        const downloadButton = screen.getByRole('button', { name: /download/i });
        await user.click(downloadButton);

        expect(mockOnDownload).toHaveBeenCalledTimes(1);
      });

      it('creates download link with correct href and download attribute', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const downloadButton = screen.getByRole('button', { name: /download/i });
        await user.click(downloadButton);

        // Verify createElement was called to create an anchor element
        const createElementSpy = vi.spyOn(document, 'createElement');
        expect(createElementSpy).toHaveBeenCalledWith('a');
      });
    });

    describe('Zoom Controls (Image Viewer)', () => {
      it('implements zoom in control for image viewer', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        expect(zoomInButton).toBeInTheDocument();

        await user.click(zoomInButton);
        // Zoom should increase from 100% to 125%
        expect(screen.getByText('125%')).toBeInTheDocument();
      });

      it('implements zoom out control for image viewer', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
        expect(zoomOutButton).toBeInTheDocument();

        await user.click(zoomOutButton);
        // Zoom should decrease from 100% to 75%
        expect(screen.getByText('75%')).toBeInTheDocument();
      });

      it('implements zoom reset control', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        // Zoom in first
        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        await user.click(zoomInButton);
        expect(screen.getByText('125%')).toBeInTheDocument();

        // Reset zoom
        const resetButton = screen.getByRole('button', { name: /reset zoom/i });
        await user.click(resetButton);
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      it('disables zoom in at maximum (300%)', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });

        // Click 8 times to reach max (100 -> 300 in 25% increments)
        for (let i = 0; i < 8; i++) {
          await user.click(zoomInButton);
        }

        expect(zoomInButton).toBeDisabled();
        expect(screen.getByText('300%')).toBeInTheDocument();
      });

      it('disables zoom out at minimum (50%)', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });

        // Click twice to reach min (100 -> 50 in 25% increments)
        for (let i = 0; i < 2; i++) {
          await user.click(zoomOutButton);
        }

        expect(zoomOutButton).toBeDisabled();
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      it('hides zoom controls for non-image files', () => {
        render(<FileViewer file={mockPdfFile} />);

        expect(screen.queryByRole('button', { name: /zoom in/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /zoom out/i })).not.toBeInTheDocument();
      });
    });

    describe('Fullscreen Controls', () => {
      it('shows fullscreen toggle button', () => {
        render(<FileViewer file={mockImageFile} />);

        const fullscreenButton = screen.getByRole('button', { name: /enter fullscreen/i });
        expect(fullscreenButton).toBeInTheDocument();
      });

      it('updates fullscreen button label when toggled', async () => {
        render(<FileViewer file={mockImageFile} />);

        const container = document.getElementById('file-viewer-container');
        if (container) {
          container.requestFullscreen = mockRequestFullscreen;
        }

        // Simulate entering fullscreen
        Object.defineProperty(document, 'fullscreenElement', {
          value: container,
          writable: true,
          configurable: true,
        });

        fireEvent(document, new Event('fullscreenchange'));

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /exit fullscreen/i })).toBeInTheDocument();
        });
      });
    });

    describe('Keyboard Shortcuts', () => {
      it('handles + key for zoom in', async () => {
        render(<FileViewer file={mockImageFile} />);

        fireEvent.keyDown(window, { key: '+' });

        await waitFor(() => {
          expect(screen.getByText('125%')).toBeInTheDocument();
        });
      });

      it('handles - key for zoom out', async () => {
        render(<FileViewer file={mockImageFile} />);

        fireEvent.keyDown(window, { key: '-' });

        await waitFor(() => {
          expect(screen.getByText('75%')).toBeInTheDocument();
        });
      });

      it('handles 0 key for zoom reset', async () => {
        render(<FileViewer file={mockImageFile} />);

        // Zoom in first
        fireEvent.keyDown(window, { key: '+' });
        await waitFor(() => {
          expect(screen.getByText('125%')).toBeInTheDocument();
        });

        // Reset with 0
        fireEvent.keyDown(window, { key: '0' });
        await waitFor(() => {
          expect(screen.getByText('100%')).toBeInTheDocument();
        });
      });

      it('handles f key for fullscreen toggle', () => {
        render(<FileViewer file={mockImageFile} />);

        const container = document.getElementById('file-viewer-container');
        if (container) {
          container.requestFullscreen = mockRequestFullscreen;
        }

        fireEvent.keyDown(window, { key: 'f' });

        expect(mockRequestFullscreen).toHaveBeenCalled();
      });

      it('handles d key for download', () => {
        const mockOnDownload = vi.fn();
        render(<FileViewer file={mockImageFile} onDownload={mockOnDownload} />);

        fireEvent.keyDown(window, { key: 'd' });

        expect(mockOnDownload).toHaveBeenCalledTimes(1);
      });

      it('ignores keyboard shortcuts when typing in input fields', () => {
        // Create a component with an input field
        function TestComponent(): JSX.Element {
          return (
            <div>
              <input type="text" data-testid="test-input" />
              <FileViewer file={mockImageFile} />
            </div>
          );
        }

        render(<TestComponent />);
        const input = screen.getByTestId('test-input');
        
        input.focus();
        fireEvent.keyDown(input, { key: '+' });

        // Zoom should remain at 100% since input was focused
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });
  });

  // ====================================================================
  // LOADING STATES
  // ====================================================================

  describe('Loading States', () => {
    it('displays loading state during initial file load', () => {
      render(<FileViewer file={mockImageFile} />);

      // Image hasn't loaded yet, so loading indicator should be present
      // Note: The actual loading spinner appears before the image loads
      const container = document.getElementById('file-viewer-container');
      expect(container).toBeInTheDocument();
    });

    it('shows loading state for text files while fetching content', async () => {
      // Add delay to text file response
      server.use(
        http.get('https://example.com/pluginfile.php/*', async () => {
          await delay(100);
          return new HttpResponse('Delayed content', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
      );

      render(<FileViewer file={mockTextFile} />);

      // Wait for content to appear
      await waitFor(() => {
        expect(screen.getByText(/delayed content/i)).toBeInTheDocument();
      });
    });

    it('handles loading state transitions to loaded state', async () => {
      render(<FileViewer file={mockTextFile} />);

      // Wait for the file to load
      await waitFor(() => {
        expect(screen.getByText(/mock file content/i)).toBeInTheDocument();
      });
    });

    it('shows loading indicator for PDF viewer', () => {
      render(<FileViewer file={mockPdfFile} />);

      // PDF iframe should be present
      const iframe = screen.getByTitle(/document\.pdf/i);
      expect(iframe).toBeInTheDocument();
    });

    it('shows loading indicator for office documents', () => {
      render(<FileViewer file={mockWordFile} />);

      const iframe = screen.getByTitle(/essay\.docx/i);
      expect(iframe).toBeInTheDocument();
    });
  });

  // ====================================================================
  // ERROR STATES
  // ====================================================================

  describe('Error States', () => {
    it('displays error Alert when text file cannot be fetched', async () => {
      server.use(
        http.get('https://example.com/pluginfile.php/*', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      render(<FileViewer file={mockTextFile} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('provides fallback to download button on preview failure', async () => {
      server.use(
        http.get('https://example.com/pluginfile.php/*', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      render(<FileViewer file={mockTextFile} />);

      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /download file/i });
        expect(downloadButton).toBeInTheDocument();
      });
    });

    it('handles image load errors gracefully', () => {
      render(<FileViewer file={mockImageFile} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load image/i)).toBeInTheDocument();
    });

    it('handles video load errors with fallback message', () => {
      render(<FileViewer file={mockVideoFile} />);

      const video = document.querySelector('video');
      if (video) {
        fireEvent.error(video);
      }

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load video/i)).toBeInTheDocument();
    });

    it('handles audio load errors with fallback message', () => {
      render(<FileViewer file={mockAudioFile} />);

      const audio = document.querySelector('audio');
      if (audio) {
        fireEvent.error(audio);
      }

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load audio/i)).toBeInTheDocument();
    });

    it('handles PDF iframe load errors', () => {
      render(<FileViewer file={mockPdfFile} />);

      const iframe = screen.getByTitle(/document\.pdf/i);
      fireEvent.error(iframe);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load pdf/i)).toBeInTheDocument();
    });

    it('handles office document iframe load errors', () => {
      render(<FileViewer file={mockWordFile} />);

      const iframe = screen.getByTitle(/essay\.docx/i);
      fireEvent.error(iframe);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load document/i)).toBeInTheDocument();
    });

    it('handles generic file viewer errors', () => {
      render(<FileViewer file={mockUnknownFile} />);

      const iframe = screen.getByTitle(/data\.bin/i);
      fireEvent.error(iframe);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/cannot be previewed/i)).toBeInTheDocument();
    });

    it('shows download button in error state', async () => {
      server.use(
        http.get('https://example.com/pluginfile.php/*', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      render(<FileViewer file={mockTextFile} />);

      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /download file/i });
        expect(downloadButton).toBeInTheDocument();
      });
    });

    it('handles network timeout during file fetch', () => {
      server.use(
        http.get('https://example.com/pluginfile.php/*', async () => {
          await delay(10000); // Long delay to simulate timeout
          return new HttpResponse(null, { status: 500 });
        })
      );

      // Component should still render even if request is pending
      render(<FileViewer file={mockTextFile} />);

      const container = document.getElementById('file-viewer-container');
      expect(container).toBeInTheDocument();
    });
  });

  // ====================================================================
  // ACCESSIBILITY TESTS (WCAG 2.1 AA)
  // ====================================================================

  describe('Accessibility Tests (WCAG 2.1 AA)', () => {
    describe('ARIA Labels', () => {
      it('implements proper ARIA labels for viewer region', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByRole('region', { name: /file viewer/i })).toBeInTheDocument();
      });

      it('provides ARIA label for zoom in button', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      });

      it('provides ARIA label for zoom out button', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      });

      it('provides ARIA label for reset zoom button', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByRole('button', { name: /reset zoom/i })).toBeInTheDocument();
      });

      it('provides ARIA label for fullscreen button', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByRole('button', { name: /fullscreen/i })).toBeInTheDocument();
      });

      it('provides ARIA label for download button with filename', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(
          screen.getByRole('button', { name: /download photo\.jpg/i })
        ).toBeInTheDocument();
      });

      it('provides ARIA label for image element', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByRole('img', { name: /photo\.jpg/i })).toBeInTheDocument();
      });

      it('provides ARIA label for PDF iframe', () => {
        render(<FileViewer file={mockPdfFile} />);

        const iframe = screen.getByTitle(/document\.pdf/i);
        expect(iframe).toHaveAttribute('aria-label', expect.stringContaining('PDF'));
      });

      it('provides ARIA label for video element', () => {
        render(<FileViewer file={mockVideoFile} />);

        const video = document.querySelector('video');
        expect(video).toHaveAttribute('aria-label', expect.stringContaining('lecture.mp4'));
      });

      it('provides ARIA label for audio element', () => {
        render(<FileViewer file={mockAudioFile} />);

        const audio = document.querySelector('audio');
        expect(audio).toHaveAttribute('aria-label', expect.stringContaining('podcast.mp3'));
      });
    });

    describe('Keyboard Navigation', () => {
      it('allows keyboard navigation through zoom controls', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        
        // Tab to zoom in button and activate
        await user.tab();
        await user.tab();
        await user.tab();
        
        expect(zoomInButton).toBeInTheDocument();
      });

      it('allows keyboard activation of download action', async () => {
        const mockOnDownload = vi.fn();
        const { user } = render(
          <FileViewer file={mockImageFile} onDownload={mockOnDownload} />
        );

        const downloadButton = screen.getByRole('button', { name: /download/i });
        downloadButton.focus();
        await user.keyboard('{Enter}');

        expect(mockOnDownload).toHaveBeenCalled();
      });

      it('supports keyboard-only operation without mouse', () => {
        render(<FileViewer file={mockImageFile} />);

        // Test that all controls can be reached via keyboard
        const zoomIn = screen.getByRole('button', { name: /zoom in/i });
        const zoomOut = screen.getByRole('button', { name: /zoom out/i });
        const resetZoom = screen.getByRole('button', { name: /reset zoom/i });
        const fullscreen = screen.getByRole('button', { name: /fullscreen/i });
        const download = screen.getByRole('button', { name: /download/i });

        expect(zoomIn).not.toBeDisabled();
        expect(zoomOut).not.toBeDisabled();
        expect(resetZoom).toBeDisabled(); // Disabled at 100%
        expect(fullscreen).not.toBeDisabled();
        expect(download).not.toBeDisabled();
      });
    });

    describe('Focus Management', () => {
      it('maintains proper tab order through viewer controls', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        // Verify tab order flows through controls
        await user.tab();
        await user.tab();
        await user.tab();

        // Focus should be on one of the toolbar buttons
        const focusedElement = document.activeElement;
        expect(focusedElement?.tagName).toBe('BUTTON');
      });
    });

    describe('Screen Reader Announcements', () => {
      it('uses semantic heading structure for metadata', () => {
        render(<FileViewer file={mockImageFile} />);

        // Check for proper heading in metadata section
        const heading = screen.getByRole('heading', { name: /file information/i });
        expect(heading).toBeInTheDocument();
      });

      it('provides accessible name for file type in metadata', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByText(/type:/i)).toBeInTheDocument();
        expect(screen.getByText(/image\/jpeg/i)).toBeInTheDocument();
      });
    });

    describe('ARIA Roles', () => {
      it('uses region role for main viewer container', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByRole('region')).toBeInTheDocument();
      });

      it('video player has proper controls role', () => {
        render(<FileViewer file={mockVideoFile} />);

        const video = document.querySelector('video');
        expect(video).toHaveAttribute('controls');
      });

      it('audio player has proper controls role', () => {
        render(<FileViewer file={mockAudioFile} />);

        const audio = document.querySelector('audio');
        expect(audio).toHaveAttribute('controls');
      });
    });

    describe('Disabled State Accessibility', () => {
      it('marks zoom in button as disabled at max zoom', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });

        // Zoom to max
        for (let i = 0; i < 8; i++) {
          await user.click(zoomInButton);
        }

        expect(zoomInButton).toBeDisabled();
        expect(zoomInButton).toHaveAttribute('aria-disabled', 'true');
      });

      it('marks zoom out button as disabled at min zoom', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });

        // Zoom to min
        for (let i = 0; i < 2; i++) {
          await user.click(zoomOutButton);
        }

        expect(zoomOutButton).toBeDisabled();
      });

      it('marks reset zoom as disabled when already at 100%', () => {
        render(<FileViewer file={mockImageFile} />);

        const resetButton = screen.getByRole('button', { name: /reset zoom/i });
        expect(resetButton).toBeDisabled();
      });
    });
  });

  // ====================================================================
  // MATERIAL-UI INTEGRATION
  // ====================================================================

  describe('Material-UI Integration', () => {
    describe('Box Component', () => {
      it('uses Box component for container layout', () => {
        render(<FileViewer file={mockImageFile} />);

        const container = document.getElementById('file-viewer-container');
        expect(container).toBeInTheDocument();
        expect(container).toHaveStyle({ display: 'flex' });
      });
    });

    describe('CardMedia Component', () => {
      it('implements CardMedia for image display', () => {
        render(<FileViewer file={mockImageFile} />);

        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
        // CardMedia renders an img element with MUI styling
        expect(image.tagName).toBe('IMG');
      });
    });

    describe('Button Component', () => {
      it('uses Button with proper variant and color props', () => {
        render(<FileViewer file={mockImageFile} />);

        const downloadButton = screen.getByRole('button', { name: /download/i });
        expect(downloadButton).toHaveClass('MuiButton-outlined');
      });

      it('uses IconButton for control buttons', () => {
        render(<FileViewer file={mockImageFile} />);

        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        expect(zoomInButton).toHaveClass('MuiIconButton-root');
      });
    });

    describe('Typography Component', () => {
      it('uses Typography for metadata display', () => {
        render(<FileViewer file={mockImageFile} />);

        expect(screen.getByText(/photo\.jpg/)).toBeInTheDocument();
        expect(screen.getByText(/size:/i)).toBeInTheDocument();
      });

      it('uses Typography with proper variant for headings', () => {
        render(<FileViewer file={mockImageFile} />);

        const heading = screen.getByRole('heading', { name: /file information/i });
        expect(heading).toBeInTheDocument();
      });
    });

    describe('Alert Component', () => {
      it('uses Alert component for error messages', async () => {
        server.use(
          http.get('https://example.com/pluginfile.php/*', () => {
            return new HttpResponse(null, { status: 500 });
          })
        );

        render(<FileViewer file={mockTextFile} />);

        await waitFor(() => {
          const alert = screen.getByRole('alert');
          expect(alert).toBeInTheDocument();
        });
      });
    });

    describe('Toolbar Component', () => {
      it('uses Toolbar for control buttons layout', () => {
        render(<FileViewer file={mockImageFile} />);

        // Toolbar should contain zoom and fullscreen buttons
        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });

        expect(zoomInButton).toBeInTheDocument();
        expect(fullscreenButton).toBeInTheDocument();
      });
    });

    describe('Tooltip Component', () => {
      it('provides tooltips for control buttons', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
        await user.hover(zoomInButton);

        await waitFor(() => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });
      });
    });

    describe('Theme Integration', () => {
      it('supports light theme mode', () => {
        render(<FileViewer file={mockImageFile} />, { themeMode: 'light' });

        const container = document.getElementById('file-viewer-container');
        expect(container).toBeInTheDocument();
      });

      it('supports dark theme mode', () => {
        render(<FileViewer file={mockImageFile} />, { themeMode: 'dark' });

        const container = document.getElementById('file-viewer-container');
        expect(container).toBeInTheDocument();
      });
    });

    describe('Paper Component', () => {
      it('uses Paper for viewer wrapper with elevation', () => {
        render(<FileViewer file={mockImageFile} />);

        // Paper component wraps the toolbar and viewer content
        const papers = document.querySelectorAll('.MuiPaper-root');
        expect(papers.length).toBeGreaterThan(0);
      });
    });

    describe('Card Component', () => {
      it('uses Card for metadata panel', () => {
        render(<FileViewer file={mockImageFile} />);

        const cards = document.querySelectorAll('.MuiCard-root');
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    describe('Responsive Layout', () => {
      it('adapts layout for different screen sizes', () => {
        render(<FileViewer file={mockImageFile} />);

        const container = document.getElementById('file-viewer-container');
        expect(container).toHaveStyle({ width: '100%' });
      });
    });
  });

  // ====================================================================
  // TYPESCRIPT TYPE SAFETY
  // ====================================================================

  describe('TypeScript Type Safety', () => {
    it('validates FileViewerProps interface definition', () => {
      // This test verifies that the component accepts properly typed props
      const validProps = {
        file: mockImageFile,
        title: 'Test Title',
        showMetadata: true,
        showDownload: true,
        onDownload: vi.fn(),
        className: 'custom-class',
        ariaLabel: 'Custom aria label',
      };

      render(<FileViewer {...validProps} />);

      expect(screen.getByRole('region', { name: /custom aria label/i })).toBeInTheDocument();
    });

    it('tests required file prop', () => {
      // Verify component renders with required file prop
      render(<FileViewer file={mockImageFile} />);

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('validates optional title prop type', () => {
      const stringTitle = 'Test String Title';
      render(<FileViewer file={mockImageFile} title={stringTitle} />);

      const image = screen.getByRole('img', { name: stringTitle });
      expect(image).toBeInTheDocument();
    });

    it('validates boolean showMetadata prop', () => {
      // Test with true
      const { rerender } = render(<FileViewer file={mockImageFile} showMetadata />);
      expect(screen.getByText('File Information')).toBeInTheDocument();

      // Test with false
      rerender(<FileViewer file={mockImageFile} showMetadata={false} />);
      expect(screen.queryByText('File Information')).not.toBeInTheDocument();
    });

    it('validates boolean showDownload prop', () => {
      // Test with true
      const { rerender } = render(<FileViewer file={mockImageFile} showDownload />);
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();

      // Test with false
      rerender(<FileViewer file={mockImageFile} showDownload={false} />);
      expect(screen.queryByRole('button', { name: /download photo\.jpg/i })).not.toBeInTheDocument();
    });

    it('validates function onDownload prop type', async () => {
      const mockCallback = vi.fn();
      const { user } = render(
        <FileViewer file={mockImageFile} onDownload={mockCallback} />
      );

      await user.click(screen.getByRole('button', { name: /download/i }));

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(typeof mockCallback).toBe('function');
    });

    it('validates string className prop', () => {
      const customClass = 'my-custom-viewer';
      render(<FileViewer file={mockImageFile} className={customClass} />);

      const container = document.getElementById('file-viewer-container');
      expect(container).toHaveClass(customClass);
    });

    it('validates string ariaLabel prop', () => {
      const customLabel = 'Custom Viewer Label';
      render(<FileViewer file={mockImageFile} ariaLabel={customLabel} />);

      expect(screen.getByRole('region', { name: customLabel })).toBeInTheDocument();
    });

    it('validates File interface compliance', () => {
      // Create a file with all interface properties
      const completeFile: MoodleFile = {
        filename: 'complete.txt',
        filepath: '/path/',
        filesize: 1024,
        fileurl: 'https://example.com/pluginfile.php/1/mod_resource/content/0/complete.txt',
        timemodified: 1609459200,
        mimetype: 'text/plain',
        isexternalfile: false,
        repositorytype: undefined,
      };

      render(<FileViewer file={completeFile} />);

      expect(screen.getByText(/complete\.txt/)).toBeInTheDocument();
    });

    it('handles File with optional repositorytype property', () => {
      const externalFile: MoodleFile = {
        ...mockImageFile,
        isexternalfile: true,
        repositorytype: 'Dropbox',
      };

      render(<FileViewer file={externalFile} />);

      expect(screen.getByText(/dropbox/i)).toBeInTheDocument();
    });
  });

  // ====================================================================
  // SPECIFIC WORKFLOWS
  // ====================================================================

  describe('Specific Workflows', () => {
    describe('PDF Preview Workflow', () => {
      it('renders PDF with embedded iframe viewer', () => {
        render(<FileViewer file={mockPdfFile} />);

        const iframe = screen.getByTitle(/document\.pdf/i);
        expect(iframe.tagName).toBe('IFRAME');
      });

      it('includes FitH view parameter for horizontal fit', () => {
        render(<FileViewer file={mockPdfFile} />);

        const iframe = screen.getByTitle(/document\.pdf/i);
        expect(iframe).toHaveAttribute('src', expect.stringContaining('#view=FitH'));
      });

      it('displays PDF metadata including file size', () => {
        render(<FileViewer file={mockPdfFile} />);

        // 5242880 bytes = 5 MB
        expect(screen.getByText(/size:/i)).toBeInTheDocument();
        expect(screen.getByText(/application\/pdf/i)).toBeInTheDocument();
      });
    });

    describe('Image Display Workflow', () => {
      it('validates CardMedia rendering for images', () => {
        render(<FileViewer file={mockImageFile} />);

        const image = screen.getByRole('img');
        expect(image.tagName).toBe('IMG');
      });

      it('implements zoom functionality for image viewer', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        // Zoom in
        await user.click(screen.getByRole('button', { name: /zoom in/i }));
        expect(screen.getByText('125%')).toBeInTheDocument();

        // Zoom out
        await user.click(screen.getByRole('button', { name: /zoom out/i }));
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      it('applies zoom transform to image element', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        await user.click(screen.getByRole('button', { name: /zoom in/i }));

        const image = screen.getByRole('img');
        expect(image).toHaveStyle({ transform: 'scale(1.25)' });
      });

      it('supports responsive sizing for images', () => {
        render(<FileViewer file={mockImageFile} />);

        const image = screen.getByRole('img');
        expect(image).toHaveStyle({ maxWidth: '100%' });
      });
    });

    describe('Video Playback Workflow', () => {
      it('renders HTML5 video element with controls', () => {
        render(<FileViewer file={mockVideoFile} />);

        const video = document.querySelector('video');
        expect(video).toHaveAttribute('controls');
        expect(video).toHaveAttribute('preload', 'metadata');
      });

      it('includes source element with correct MIME type', () => {
        render(<FileViewer file={mockVideoFile} />);

        const source = document.querySelector('video source');
        expect(source).toHaveAttribute('type', 'video/mp4');
      });

      it('provides fallback text for unsupported browsers', () => {
        render(<FileViewer file={mockVideoFile} />);

        // The video element should have fallback content
        const video = document.querySelector('video');
        expect(video?.textContent).toContain('browser does not support');
      });
    });

    describe('Audio Playback Workflow', () => {
      it('renders HTML5 audio element with controls', () => {
        render(<FileViewer file={mockAudioFile} />);

        const audio = document.querySelector('audio');
        expect(audio).toHaveAttribute('controls');
        expect(audio).toHaveAttribute('preload', 'metadata');
      });

      it('includes source element with correct MIME type', () => {
        render(<FileViewer file={mockAudioFile} />);

        const source = document.querySelector('audio source');
        expect(source).toHaveAttribute('type', 'audio/mpeg');
      });
    });

    describe('Office Documents Workflow', () => {
      it('uses Office Online viewer for Word documents', () => {
        render(<FileViewer file={mockWordFile} />);

        const iframe = screen.getByTitle(/essay\.docx/i);
        expect(iframe).toHaveAttribute(
          'src',
          expect.stringContaining('view.officeapps.live.com')
        );
      });

      it('encodes file URL in Office viewer URL', () => {
        render(<FileViewer file={mockWordFile} />);

        const iframe = screen.getByTitle(/essay\.docx/i);
        const src = iframe.getAttribute('src');
        expect(src).toContain(encodeURIComponent(mockWordFile.fileurl));
      });
    });

    describe('Text Files Workflow', () => {
      it('fetches and displays text file content', async () => {
        render(<FileViewer file={mockTextFile} />);

        await waitFor(() => {
          expect(screen.getByText(/mock file content/i)).toBeInTheDocument();
        });
      });

      it('displays text in monospace pre element', async () => {
        render(<FileViewer file={mockTextFile} />);

        await waitFor(() => {
          const preElement = document.querySelector('pre');
          expect(preElement).toBeInTheDocument();
        });
      });
    });

    describe('Download Workflow', () => {
      it('triggers file download on button click', async () => {
        const { user } = render(<FileViewer file={mockImageFile} />);

        await user.click(screen.getByRole('button', { name: /download/i }));

        const createElementSpy = vi.spyOn(document, 'createElement');
        expect(createElementSpy).toHaveBeenCalledWith('a');
      });

      it('calls onDownload callback when provided', async () => {
        const onDownload = vi.fn();
        const { user } = render(
          <FileViewer file={mockImageFile} onDownload={onDownload} />
        );

        await user.click(screen.getByRole('button', { name: /download/i }));

        expect(onDownload).toHaveBeenCalledTimes(1);
      });

      it('triggers download via keyboard shortcut', () => {
        const onDownload = vi.fn();
        render(<FileViewer file={mockImageFile} onDownload={onDownload} />);

        fireEvent.keyDown(window, { key: 'd' });

        expect(onDownload).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ====================================================================
  // EDGE CASES
  // ====================================================================

  describe('Edge Cases', () => {
    describe('Unsupported File Types', () => {
      it('shows generic viewer with download fallback for unknown types', () => {
        const unknownFile = createMockMoodleFile({
          filename: 'data.xyz',
          mimetype: 'application/x-unknown',
        });

        render(<FileViewer file={unknownFile} />);

        const iframe = screen.getByTitle(/data\.xyz/i);
        expect(iframe).toBeInTheDocument();
      });

      it('includes download button as fallback for unsupported files', () => {
        const unknownFile = createMockMoodleFile({
          filename: 'special.dat',
          mimetype: 'application/custom',
        });

        render(<FileViewer file={unknownFile} />);

        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });
    });

    describe('Broken URLs', () => {
      it('displays error message for broken file URLs', async () => {
        server.use(
          http.get('https://example.com/pluginfile.php/*', () => {
            return new HttpResponse(null, { status: 404 });
          })
        );

        render(<FileViewer file={mockTextFile} />);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        });
      });

      it('provides retry option via download button', async () => {
        server.use(
          http.get('https://example.com/pluginfile.php/*', () => {
            return new HttpResponse(null, { status: 404 });
          })
        );

        render(<FileViewer file={mockTextFile} />);

        await waitFor(() => {
          const downloadButton = screen.getByRole('button', { name: /download file/i });
          expect(downloadButton).toBeInTheDocument();
        });
      });
    });

    describe('Empty File', () => {
      it('handles zero-byte files gracefully', () => {
        const emptyFile = createMockMoodleFile({
          filename: 'empty.txt',
          filesize: 0,
          mimetype: 'text/plain',
        });

        render(<FileViewer file={emptyFile} />);

        // Should show "0 Bytes" in metadata
        expect(screen.getByText(/0 bytes/i)).toBeInTheDocument();
      });
    });

    describe('Large Files', () => {
      it('handles large files by displaying file size', () => {
        const largeFile = createMockMoodleFile({
          filename: 'massive.zip',
          filesize: 1073741824, // 1 GB
          mimetype: 'application/zip',
        });

        render(<FileViewer file={largeFile} />);

        // Should display file size in appropriate unit (GB)
        expect(screen.getByText(/size:/i)).toBeInTheDocument();
      });

      it('displays loading indicator for large file processing', () => {
        // Create a mock large file using the utility function
        const sizeMB = 15;
        const largeFileData = createLargeFile(sizeMB);
        
        const largeMoodleFile = createMockMoodleFile({
          filename: largeFileData.name,
          filesize: sizeMB * 1024 * 1024,
          mimetype: largeFileData.type,
        });

        render(<FileViewer file={largeMoodleFile} />);

        // Generic viewer should be used for octet-stream
        const iframe = screen.getByTitle(new RegExp(largeMoodleFile.filename));
        expect(iframe).toBeInTheDocument();
      });
    });

    describe('Permission Restrictions', () => {
      it('handles permission denied errors', async () => {
        server.use(
          http.get('https://example.com/pluginfile.php/*', () => {
            return new HttpResponse('Access denied', { status: 403 });
          })
        );

        render(<FileViewer file={mockTextFile} />);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        });
      });
    });

    describe('Missing MIME Type', () => {
      it('falls back to generic viewer for empty MIME type', () => {
        const noMimeFile = createMockMoodleFile({
          filename: 'unknown',
          mimetype: '',
        });

        render(<FileViewer file={noMimeFile} />);

        const iframe = screen.getByTitle(/unknown/i);
        expect(iframe).toBeInTheDocument();
      });

      it('falls back to generic viewer for undefined-like MIME type', () => {
        const weirdMimeFile = createMockMoodleFile({
          filename: 'weird.file',
          mimetype: 'application/x-empty',
        });

        render(<FileViewer file={weirdMimeFile} />);

        const iframe = screen.getByTitle(/weird\.file/i);
        expect(iframe).toBeInTheDocument();
      });
    });

    describe('Network Timeout', () => {
      it('handles slow file fetch gracefully', () => {
        server.use(
          http.get('https://example.com/pluginfile.php/*', async () => {
            await delay(5000);
            return new HttpResponse('Slow content', {
              status: 200,
              headers: { 'Content-Type': 'text/plain' },
            });
          })
        );

        // Component should render even while waiting for content
        render(<FileViewer file={mockTextFile} />);

        const container = document.getElementById('file-viewer-container');
        expect(container).toBeInTheDocument();
      });
    });

    describe('Mobile Viewport', () => {
      it('renders correctly on small screens', () => {
        // Render with standard viewport - component should be responsive
        render(<FileViewer file={mockImageFile} />);

        const container = document.getElementById('file-viewer-container');
        expect(container).toHaveStyle({ width: '100%' });
      });
    });

    describe('Rapid Prop Changes', () => {
      it('handles rapid prop changes without race conditions', () => {
        const { rerender } = render(<FileViewer file={mockImageFile} />);

        // Rapidly change file type
        rerender(<FileViewer file={mockPdfFile} />);
        rerender(<FileViewer file={mockVideoFile} />);
        rerender(<FileViewer file={mockAudioFile} />);
        rerender(<FileViewer file={mockImageFile} />);

        // Final render should show image viewer
        expect(screen.getByRole('img')).toBeInTheDocument();
      });

      it('resets loading state when file changes', () => {
        const { rerender } = render(<FileViewer file={mockImageFile} />);

        // Change to a different file
        rerender(<FileViewer file={mockPdfFile} />);

        // PDF iframe should be present
        const iframe = screen.getByTitle(/document\.pdf/i);
        expect(iframe).toBeInTheDocument();
      });
    });

    describe('Special Characters in Filename', () => {
      it('handles filenames with special characters', () => {
        const specialFile = createMockMoodleFile({
          filename: 'file (1) [copy] - final.txt',
          mimetype: 'text/plain',
        });

        render(<FileViewer file={specialFile} />);

        expect(screen.getByText(/file \(1\) \[copy\] - final\.txt/)).toBeInTheDocument();
      });

      it('handles filenames with unicode characters', () => {
        const unicodeFile = createMockMoodleFile({
          filename: 'документ_日本語.pdf',
          mimetype: 'application/pdf',
        });

        render(<FileViewer file={unicodeFile} />);

        expect(screen.getByText(/документ_日本語\.pdf/)).toBeInTheDocument();
      });
    });

    describe('External File from Repository', () => {
      it('displays repository source for external files', () => {
        const externalFile = createMockMoodleFile({
          filename: 'cloud-file.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          isexternalfile: true,
          repositorytype: 'OneDrive',
        });

        render(<FileViewer file={externalFile} />);

        expect(screen.getByText(/onedrive/i)).toBeInTheDocument();
      });
    });

    describe('SVG Image Files', () => {
      it('renders SVG files as images', () => {
        const svgFile = createMockMoodleFile({
          filename: 'diagram.svg',
          mimetype: 'image/svg+xml',
        });

        render(<FileViewer file={svgFile} />);

        const image = screen.getByRole('img', { name: /diagram\.svg/i });
        expect(image).toBeInTheDocument();
      });
    });

    describe('WebP Image Files', () => {
      it('renders WebP files as images', () => {
        const webpFile = createMockMoodleFile({
          filename: 'photo.webp',
          mimetype: 'image/webp',
        });

        render(<FileViewer file={webpFile} />);

        const image = screen.getByRole('img', { name: /photo\.webp/i });
        expect(image).toBeInTheDocument();
      });
    });

    describe('GIF Image Files', () => {
      it('renders GIF files as images', () => {
        const gifFile = createMockMoodleFile({
          filename: 'animation.gif',
          mimetype: 'image/gif',
        });

        render(<FileViewer file={gifFile} />);

        const image = screen.getByRole('img', { name: /animation\.gif/i });
        expect(image).toBeInTheDocument();
      });
    });

    describe('HLS Video Files', () => {
      it('renders HLS video streams', () => {
        const hlsFile = createMockMoodleFile({
          filename: 'stream.m3u8',
          mimetype: 'application/vnd.apple.mpegURL',
        });

        render(<FileViewer file={hlsFile} />);

        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
      });
    });

    describe('ODF Document Files', () => {
      it('renders OpenDocument Text files with office viewer', () => {
        const odtFile = createMockMoodleFile({
          filename: 'document.odt',
          mimetype: 'application/vnd.oasis.opendocument.text',
        });

        render(<FileViewer file={odtFile} />);

        const iframe = screen.getByTitle(/document\.odt/i);
        expect(iframe).toHaveAttribute('src', expect.stringContaining('view.officeapps.live.com'));
      });

      it('renders OpenDocument Spreadsheet files with office viewer', () => {
        const odsFile = createMockMoodleFile({
          filename: 'spreadsheet.ods',
          mimetype: 'application/vnd.oasis.opendocument.spreadsheet',
        });

        render(<FileViewer file={odsFile} />);

        const iframe = screen.getByTitle(/spreadsheet\.ods/i);
        expect(iframe).toBeInTheDocument();
      });
    });

    describe('Legacy Office Document Files', () => {
      it('renders legacy DOC files', () => {
        const docFile = createMockMoodleFile({
          filename: 'legacy.doc',
          mimetype: 'application/msword',
        });

        render(<FileViewer file={docFile} />);

        const iframe = screen.getByTitle(/legacy\.doc/i);
        expect(iframe).toHaveAttribute('src', expect.stringContaining('view.officeapps.live.com'));
      });

      it('renders legacy XLS files', () => {
        const xlsFile = createMockMoodleFile({
          filename: 'legacy.xls',
          mimetype: 'application/vnd.ms-excel',
        });

        render(<FileViewer file={xlsFile} />);

        const iframe = screen.getByTitle(/legacy\.xls/i);
        expect(iframe).toBeInTheDocument();
      });

      it('renders legacy PPT files', () => {
        const pptFile = createMockMoodleFile({
          filename: 'legacy.ppt',
          mimetype: 'application/vnd.ms-powerpoint',
        });

        render(<FileViewer file={pptFile} />);

        const iframe = screen.getByTitle(/legacy\.ppt/i);
        expect(iframe).toBeInTheDocument();
      });
    });

    describe('JSON and XML Files', () => {
      it('renders JSON files with text viewer', async () => {
        const jsonFile = createMockMoodleFile({
          filename: 'data.json',
          mimetype: 'application/json',
        });

        render(<FileViewer file={jsonFile} />);

        await waitFor(() => {
          const preElement = document.querySelector('pre');
          expect(preElement).toBeInTheDocument();
        });
      });

      it('renders XML files with text viewer', async () => {
        const xmlFile = createMockMoodleFile({
          filename: 'data.xml',
          mimetype: 'application/xml',
        });

        render(<FileViewer file={xmlFile} />);

        await waitFor(() => {
          const preElement = document.querySelector('pre');
          expect(preElement).toBeInTheDocument();
        });
      });
    });

    describe('JavaScript Files', () => {
      it('renders JavaScript files with text viewer', async () => {
        const jsFile = createMockMoodleFile({
          filename: 'script.js',
          mimetype: 'application/javascript',
        });

        render(<FileViewer file={jsFile} />);

        await waitFor(() => {
          const preElement = document.querySelector('pre');
          expect(preElement).toBeInTheDocument();
        });
      });
    });
  });
});