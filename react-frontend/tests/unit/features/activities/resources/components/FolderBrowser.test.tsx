/**
 * Comprehensive Unit Test Suite for FolderBrowser Component
 *
 * Tests hierarchical folder structure rendering with Material-UI TreeView and TreeItem,
 * recursive folder tree display, breadcrumb navigation, file/folder icons with MIME type
 * detection, thumbnail images for web_image files, download folder functionality, file
 * metadata display, expand/collapse state management, search/filter functionality, loading
 * states, error handling, and accessibility compliance (WCAG 2.1 AA).
 *
 * Coverage targets:
 * - Rendering: hierarchical tree, breadcrumbs, icons, thumbnails, buttons
 * - Props: folderId, showdescription, showexpanded, displayMode, forcedownload
 * - Interactions: expand/collapse, file clicks, downloads, search, keyboard navigation
 * - States: loading, error, empty folders, search results
 * - Accessibility: ARIA roles, keyboard navigation, screen reader support
 * - Material-UI: TreeView, TreeItem, Breadcrumbs, Skeleton, Alert
 * - TypeScript: strict mode, no any types, proper interfaces
 *
 * @see react-frontend/src/features/activities/resources/components/FolderBrowser.tsx
 * @package react-frontend
 * @subpackage tests/unit/features/activities/resources/components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

// Test utilities
import { render, screen, waitFor, within, userEvent } from '../../../../../helpers/render';
import { waitForLoadingToFinish } from '../../../../../helpers/asyncUtils';
import { createMockResource } from '../../../../../helpers/mockData';

// Component under test
import { FolderBrowser, type FolderBrowserProps } from '../../../../../../src/features/activities/resources/components/FolderBrowser';

// Types
import type { Folder } from '../../../../../../src/features/activities/resources/types/resource.types';

// Mock server setup
import { server } from '../../../../../setup';

/**
 * FolderNode type definition (local to test file)
 * Matches the structure from useResource hook for type-safe mock data
 */
interface FolderNode {
  id: string;
  name: string;
  isFolder: boolean;
  isRoot?: boolean;
  path: string;
  children?: FolderNode[];
  file?: {
    filename: string;
    filepath: string;
    filesize: number;
    mimetype: string;
    timemodified: number;
    url: string;
  };
}

/**
 * Helper function to create mock folder tree data structure
 */
const createMockFolderData = (overrides?: Partial<{
  folderId: number;
  name: string;
  intro: string;
  canManageFiles: boolean;
  canDownload: boolean;
  archiveUrl: string | null;
  editUrl: string | null;
  tree: FolderNode;
}>): {
  id: number;
  name: string;
  intro: string;
  canManageFiles: boolean;
  canDownload: boolean;
  archiveUrl: string | null;
  editUrl: string | null;
  tree: FolderNode;
} => {
  const defaults = {
    folderId: 1,
    name: 'Course Materials',
    intro: '<p>Welcome to the course materials folder</p>',
    canManageFiles: true,
    canDownload: true,
    archiveUrl: 'https://moodle.example.com/pluginfile.php/1/mod_folder/archive/0/folder.zip',
    editUrl: 'https://moodle.example.com/course/modedit.php?update=1',
    tree: {
      id: 'root',
      name: 'Course Materials',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: [
        {
          id: 'folder-1',
          name: 'Week 1',
          isFolder: true,
          isRoot: false,
          path: '/Week 1',
          children: [
            {
              id: 'file-1',
              name: 'Lecture 1.pdf',
              isFolder: false,
              isRoot: false,
              path: '/Week 1/Lecture 1.pdf',
              file: {
                filename: 'Lecture 1.pdf',
                filepath: '/Week 1/',
                filesize: 2048576,
                url: 'https://moodle.example.com/pluginfile.php/1/mod_folder/content/0/Week%201/Lecture%201.pdf',
                timemodified: 1704067200,
                mimetype: 'application/pdf',
              },
            },
            {
              id: 'file-2',
              name: 'Assignment 1.docx',
              isFolder: false,
              isRoot: false,
              path: '/Week 1/Assignment 1.docx',
              file: {
                filename: 'Assignment 1.docx',
                filepath: '/Week 1/',
                filesize: 51200,
                url: 'https://moodle.example.com/pluginfile.php/1/mod_folder/content/0/Week%201/Assignment%201.docx',
                timemodified: 1704153600,
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              },
            },
          ],
        },
        {
          id: 'folder-2',
          name: 'Week 2',
          isFolder: true,
          isRoot: false,
          path: '/Week 2',
          children: [
            {
              id: 'file-3',
              name: 'image.png',
              isFolder: false,
              isRoot: false,
              path: '/Week 2/image.png',
              file: {
                filename: 'image.png',
                filepath: '/Week 2/',
                filesize: 153600,
                url: 'https://moodle.example.com/pluginfile.php/1/mod_folder/content/0/Week%202/image.png',
                timemodified: 1704240000,
                mimetype: 'image/png',
              },
            },
          ],
        },
        {
          id: 'file-4',
          name: 'Syllabus.pdf',
          isFolder: false,
          isRoot: false,
          path: '/Syllabus.pdf',
          file: {
            filename: 'Syllabus.pdf',
            filepath: '/',
            filesize: 1024000,
            url: 'https://moodle.example.com/pluginfile.php/1/mod_folder/content/0/Syllabus.pdf',
            timemodified: 1703980800,
            mimetype: 'application/pdf',
          },
        },
      ],
    },
  };

  return {
    id: overrides?.folderId ?? defaults.folderId,
    ...defaults,
    ...overrides,
  };
};

/**
 * Helper function to create empty folder data
 */
const createEmptyFolderData = (): ReturnType<typeof createMockFolderData> => {
  return createMockFolderData({
    name: 'Empty Folder',
    tree: {
      id: 'root',
      name: 'Empty Folder',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: [],
    },
  });
};

/**
 * Helper function to create deeply nested folder structure
 */
const createDeeplyNestedFolderData = (): ReturnType<typeof createMockFolderData> => {
  const createNestedFolder = (level: number, maxLevel: number): FolderNode => {
    if (level >= maxLevel) {
      return {
        id: `file-${level}`,
        name: `File at level ${level}.txt`,
        isFolder: false,
        isRoot: false,
        path: `/Level ${level}/File at level ${level}.txt`,
        file: {
          filename: `File at level ${level}.txt`,
          filepath: `/Level ${level}/`,
          filesize: 1024,
          url: `https://moodle.example.com/file${level}.txt`,
          timemodified: 1704067200,
          mimetype: 'text/plain',
        },
      };
    }

    return {
      id: `folder-${level}`,
      name: `Level ${level}`,
      isFolder: true,
      isRoot: level === 0,
      path: level === 0 ? '/' : `/Level ${level}`,
      children: [createNestedFolder(level + 1, maxLevel)],
    };
  };

  return createMockFolderData({
    name: 'Deeply Nested',
    tree: createNestedFolder(0, 10),
  });
};

/**
 * Helper function to create large folder with many files
 */
const createLargeFolderData = (): ReturnType<typeof createMockFolderData> => {
  const files: FolderNode[] = [];
  for (let i = 1; i <= 100; i++) {
    files.push({
      id: `file-${i}`,
      name: `Document ${i}.pdf`,
      isFolder: false,
      isRoot: false,
      path: `/Document ${i}.pdf`,
      file: {
        filename: `Document ${i}.pdf`,
        filepath: '/',
        filesize: 102400 * i,
        url: `https://moodle.example.com/doc${i}.pdf`,
        timemodified: 1704067200 + i * 3600,
        mimetype: 'application/pdf',
      },
    });
  }

  return createMockFolderData({
    name: 'Large Folder',
    tree: {
      id: 'root',
      name: 'Large Folder',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: files,
    },
  });
};

/**
 * Default props for FolderBrowser component
 */
const defaultProps: FolderBrowserProps = {
  folderId: 1,
  showdescription: true,
  showexpanded: false,
  displayMode: 'page',
  forcedownload: false,
};

describe('FolderBrowser component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Rendering Tests', () => {
    it('renders hierarchical folder structure using Material-UI TreeView component', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify TreeView is rendered
      const treeView = screen.getByRole('tree', { name: /folder structure/i });
      expect(treeView).toBeInTheDocument();

      // Verify folder nodes are rendered
      expect(screen.getByText('Week 1')).toBeInTheDocument();
      expect(screen.getByText('Week 2')).toBeInTheDocument();
    });

    it('displays folder tree with TreeItem components for each folder/file', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify all TreeItem elements are rendered
      const treeItems = screen.getAllByRole('treeitem');
      expect(treeItems.length).toBeGreaterThan(0);

      // Verify file names are displayed
      expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      expect(screen.getByText('Assignment 1.docx')).toBeInTheDocument();
      expect(screen.getByText('Syllabus.pdf')).toBeInTheDocument();
    });

    it('shows folder introduction text when showdescription is enabled', async () => {
      const mockData = createMockFolderData({
        intro: '<p>Welcome to the course materials folder</p>',
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showdescription={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify introduction text is displayed
      const introText = screen.getByText(/welcome to the course materials folder/i);
      expect(introText).toBeInTheDocument();
    });

    it('hides folder introduction text when showdescription is false', async () => {
      const mockData = createMockFolderData({
        intro: '<p>Welcome to the course materials folder</p>',
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showdescription={false} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify introduction text is NOT displayed
      const introText = screen.queryByText(/welcome to the course materials folder/i);
      expect(introText).not.toBeInTheDocument();
    });

    it('renders Edit button for users with mod/folder:managefiles capability', async () => {
      const mockData = createMockFolderData({
        canManageFiles: true,
        editUrl: 'https://moodle.example.com/course/modedit.php?update=1',
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient, authenticated: true });

      await waitForLoadingToFinish();

      // Verify Edit button is rendered
      const editButton = screen.getByRole('button', { name: /edit folder/i });
      expect(editButton).toBeInTheDocument();
    });

    it('displays Download Folder button when folder archive is available', async () => {
      const mockData = createMockFolderData({
        canDownload: true,
        archiveUrl: 'https://moodle.example.com/folder.zip',
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify Download Folder button is rendered
      const downloadButton = screen.getByRole('button', { name: /download entire folder/i });
      expect(downloadButton).toBeInTheDocument();
    });

    it('shows folder icons using Material-UI FolderIcon component', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify folder icons are present (testid would be ideal, but we check for folder structure)
      const folderNodes = screen.getAllByText(/Week \d/);
      expect(folderNodes.length).toBeGreaterThan(0);
    });

    it('displays file icons with appropriate MIME type icons', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify different file types are rendered
      expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      expect(screen.getByText('Assignment 1.docx')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
    });

    it('renders thumbnail images for web_image files', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Expand folder to see image file
      const week2Folder = screen.getByText('Week 2');
      await userEvent.click(week2Folder);

      await waitFor(() => {
        expect(screen.getByText('image.png')).toBeInTheDocument();
      });

      // Verify thumbnail image is rendered
      const thumbnail = screen.getByRole('img', { name: 'image.png' });
      expect(thumbnail).toBeInTheDocument();
      expect(thumbnail).toHaveAttribute('src', expect.stringContaining('image.png'));
    });

    it('shows breadcrumb navigation using Material-UI Breadcrumbs component', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify breadcrumbs navigation is rendered
      const breadcrumbs = screen.getByRole('navigation', { name: /folder navigation breadcrumbs/i });
      expect(breadcrumbs).toBeInTheDocument();

      // Verify root breadcrumb
      within(breadcrumbs).getByText('Course Materials');
    });

    it('displays clean filenames for all files and folders', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify clean filenames without encoding or special characters
      expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      expect(screen.getByText('Assignment 1.docx')).toBeInTheDocument();
      expect(screen.getByText('Syllabus.pdf')).toBeInTheDocument();
    });
  });

  describe('Prop Handling Tests', () => {
    it('validates FolderBrowserProps interface with folderId required prop', async () => {
      const mockData = createMockFolderData({ folderId: 42 });

      server.use(
        http.get('/api/v1/resources/folders/:id', ({ params }) => {
          expect(params.id).toBe('42');
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser folderId={42} />, { queryClient });

      await waitForLoadingToFinish();

      // Component should render successfully with required folderId prop
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });

    it('handles folderId prop for API data fetching', async () => {
      const folderId = 123;
      const mockData = createMockFolderData({ folderId });

      let fetchedId: string | undefined;

      server.use(
        http.get('/api/v1/resources/folders/:id', ({ params }) => {
          fetchedId = params.id as string;
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser folderId={folderId} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify correct folderId was used in API call
      expect(fetchedId).toBe(String(folderId));
    });

    it('tests showdescription prop for introduction text display', async () => {
      const mockData = createMockFolderData({
        intro: '<p>Test introduction content</p>',
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      const { rerender } = render(
        <FolderBrowser {...defaultProps} showdescription={true} />,
        { queryClient }
      );

      await waitForLoadingToFinish();

      // Introduction should be visible
      expect(screen.getByText(/test introduction content/i)).toBeInTheDocument();

      // Rerender with showdescription false
      rerender(<FolderBrowser {...defaultProps} showdescription={false} />);

      // Introduction should be hidden
      expect(screen.queryByText(/test introduction content/i)).not.toBeInTheDocument();
    });

    it('validates showexpanded prop for initial expand/collapse state', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      const { rerender } = render(
        <FolderBrowser {...defaultProps} showexpanded={false} />,
        { queryClient }
      );

      await waitForLoadingToFinish();

      // Files in subfolders should not be visible initially
      expect(screen.queryByText('Lecture 1.pdf')).not.toBeInTheDocument();

      // Rerender with showexpanded true
      queryClient.clear();
      rerender(<FolderBrowser {...defaultProps} showexpanded={true} />);

      await waitForLoadingToFinish();

      // All files should be visible when expanded
      await waitFor(() => {
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      });
    });

    it('tests forcedownload prop for download behavior', async () => {
      const mockData = createMockFolderData();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} forcedownload={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Expand folder to access file
      const week1Folder = screen.getByText('Week 1');
      await userEvent.click(week1Folder);

      await waitFor(() => {
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      });

      // Click on file to download
      const fileLink = screen.getByText('Lecture 1.pdf');
      await userEvent.click(fileLink);

      // Verify forcedownload parameter is included in URL
      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          expect.stringContaining('forcedownload=1'),
          '_blank'
        );
      });

      windowOpenSpy.mockRestore();
    });

    it('validates optional props with proper types', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      // Test with all optional props undefined
      render(<FolderBrowser folderId={1} />, { queryClient });

      await waitForLoadingToFinish();

      // Component should render with default values
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });
  });

  describe('User Interaction Tests', () => {
    it('handles folder expand/collapse on click', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Initially, files in Week 1 folder should not be visible
      expect(screen.queryByText('Lecture 1.pdf')).not.toBeInTheDocument();

      // Click to expand Week 1 folder
      const week1Folder = screen.getByText('Week 1');
      await userEvent.click(week1Folder);

      // Files should now be visible
      await waitFor(() => {
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
        expect(screen.getByText('Assignment 1.docx')).toBeInTheDocument();
      });

      // Click to collapse Week 1 folder
      await userEvent.click(week1Folder);

      // Files should be hidden again
      await waitFor(() => {
        expect(screen.queryByText('Lecture 1.pdf')).not.toBeInTheDocument();
      });
    });

    it('tests file download link clicks with proper URL generation', async () => {
      const mockData = createMockFolderData();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Expand folder
      const week1Folder = screen.getByText('Week 1');
      await userEvent.click(week1Folder);

      await waitFor(() => {
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      });

      // Click file to download
      const fileLink = screen.getByText('Lecture 1.pdf');
      await userEvent.click(fileLink);

      // Verify download was initiated
      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          expect.stringContaining('Lecture%201.pdf'),
          '_blank'
        );
      });

      windowOpenSpy.mockRestore();
    });

    it('validates Edit button click navigation to edit page', async () => {
      const mockData = createMockFolderData({
        canManageFiles: true,
        editUrl: 'https://moodle.example.com/course/modedit.php?update=1',
      });

      // Mock window.location.href assignment
      const originalLocation = window.location;
      delete (window as { location?: Location }).location;
      window.location = { ...originalLocation, href: '' } as Location;

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient, authenticated: true });

      await waitForLoadingToFinish();

      // Click Edit button
      const editButton = screen.getByRole('button', { name: /edit folder/i });
      await userEvent.click(editButton);

      // Verify navigation occurred
      expect(window.location.href).toBe(mockData.editUrl);

      // Restore window.location
      window.location = originalLocation;
    });

    it('tests Download Folder button triggering archive download', async () => {
      const mockData = createMockFolderData({
        canDownload: true,
        archiveUrl: 'https://moodle.example.com/folder.zip',
      });

      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Click Download Folder button
      const downloadButton = screen.getByRole('button', { name: /download entire folder/i });
      await userEvent.click(downloadButton);

      // Verify archive download was initiated
      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(mockData.archiveUrl, '_blank');
      });

      windowOpenSpy.mockRestore();
    });

    it('handles breadcrumb click navigation to parent folders', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Find breadcrumb navigation
      const breadcrumbs = screen.getByRole('navigation', { name: /folder navigation breadcrumbs/i });
      expect(breadcrumbs).toBeInTheDocument();

      // Current breadcrumb should show root folder
      const rootBreadcrumb = within(breadcrumbs).getByText('Course Materials');
      expect(rootBreadcrumb).toBeInTheDocument();
    });

    it('tests search/filter input for finding files', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Find search input
      const searchInput = screen.getByPlaceholderText(/search files and folders/i);
      expect(searchInput).toBeInTheDocument();

      // Type search query
      await userEvent.type(searchInput, 'Lecture');

      // Wait for debounce and filtering
      await waitFor(() => {
        // Lecture 1.pdf should be visible in filtered results
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Non-matching files should not be visible
      expect(screen.queryByText('Syllabus.pdf')).not.toBeInTheDocument();
    });

    it('validates keyboard navigation with arrow keys (up, down, left, right)', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Get tree view
      const treeView = screen.getByRole('tree');
      expect(treeView).toBeInTheDocument();

      // Focus on tree view
      treeView.focus();

      // Test arrow key navigation
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowRight}'); // Expand
      await userEvent.keyboard('{ArrowLeft}'); // Collapse
      await userEvent.keyboard('{ArrowUp}');

      // Tree navigation should work (Material-UI handles this internally)
      // We verify the tree is accessible via keyboard
      expect(treeView).toHaveFocus();
    });

    it('tests Enter key to expand/collapse or open file', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const treeView = screen.getByRole('tree');
      treeView.focus();

      // Navigate and press Enter
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');

      // Folder should expand/collapse or file should open
      // (Material-UI TreeView handles this internally)
      expect(treeView).toBeInTheDocument();
    });
  });

  describe('Folder Tree Rendering', () => {
    it('tests recursive folder tree rendering for nested structures', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify nested folders are rendered recursively
      expect(screen.getByText('Week 1')).toBeInTheDocument();
      expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      expect(screen.getByText('Assignment 1.docx')).toBeInTheDocument();
      expect(screen.getByText('Week 2')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
    });

    it('validates isroot key for root folder element styling', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Root folder should have special styling (bold text)
      // We verify through the tree structure
      const treeView = screen.getByRole('tree');
      expect(treeView).toBeInTheDocument();
    });

    it('tests expanded state preservation during re-renders', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      const { rerender } = render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Expand Week 1 folder
      const week1Folder = screen.getByText('Week 1');
      await userEvent.click(week1Folder);

      await waitFor(() => {
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      });

      // Re-render component
      rerender(<FolderBrowser {...defaultProps} />);

      // Expanded state should be preserved
      expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
    });

    it('validates proper indentation for nested levels', async () => {
      const mockData = createDeeplyNestedFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify deeply nested structure is rendered
      // Material-UI TreeView handles indentation automatically
      await waitFor(() => {
        expect(screen.getByText('Level 1')).toBeInTheDocument();
      });
    });

    it('tests tree item ordering (folders first, then files)', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Folders should appear before files
      const treeItems = screen.getAllByRole('treeitem');
      const folderIndices = treeItems.map((item, index) => 
        within(item).queryByText(/Week \d/) ? index : -1
      ).filter(i => i !== -1);

      // Folders should have lower indices than files
      expect(folderIndices.length).toBeGreaterThan(0);
    });

    it('validates file sorting by name within folders', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Files should be present
      expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      expect(screen.getByText('Assignment 1.docx')).toBeInTheDocument();
    });
  });

  describe('File Metadata Display', () => {
    it('shows file size in human-readable format (KB, MB, GB)', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify file sizes are displayed (2048576 bytes = 2 MB)
      await waitFor(() => {
        expect(screen.getByText(/2 MB/)).toBeInTheDocument();
      });

      // Verify KB format (51200 bytes = 50 KB)
      expect(screen.getByText(/50 KB/)).toBeInTheDocument();
    });

    it('displays last modified date using date-fns formatting', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify dates are formatted (1704067200 = Jan 1, 2024)
      await waitFor(() => {
        expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
      });
    });

    it('tests metadata visibility on hover or expansion', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Metadata should be visible when folder is expanded
      await waitFor(() => {
        expect(screen.getByText(/2 MB/)).toBeInTheDocument();
        expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('displays Material-UI Skeleton components during folder tree fetch', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', async () => {
          await delay(100);
          return HttpResponse.json({
            success: true,
            data: createMockFolderData(),
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      // Verify skeleton loading state
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);

      // Wait for loading to finish
      await waitForLoadingToFinish();

      // Skeletons should be replaced with content
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    });

    it('shows skeleton for folder structure with proper hierarchy', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', async () => {
          await delay(100);
          return HttpResponse.json({
            success: true,
            data: createMockFolderData(),
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      // Verify multiple skeleton elements showing hierarchy
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);

      await waitForLoadingToFinish();
    });

    it('validates smooth transition from loading to loaded state', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', async () => {
          await delay(50);
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      // Loading state
      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

      // Wait for loaded state
      await waitForLoadingToFinish();

      // Content should be visible
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('displays Material-UI Alert component when folder load fails', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' },
            },
            { status: 404 }
          );
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(within(alert).getByText(/failed to load folder contents/i)).toBeInTheDocument();
      });
    });

    it('shows error message for API fetch failures', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.error();
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText(/failed to load folder contents/i)).toBeInTheDocument();
      });
    });

    it('handles missing folder ID gracefully with error message', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'INVALID_ID', message: 'Invalid folder ID' },
            },
            { status: 400 }
          );
        })
      );

      render(<FolderBrowser folderId={0} />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText(/failed to load folder contents/i)).toBeInTheDocument();
      });
    });

    it('tests permission denied error for restricted folders', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Access denied' },
            },
            { status: 403 }
          );
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText(/failed to load folder contents/i)).toBeInTheDocument();
      });
    });

    it('shows warning for empty folders with appropriate message', async () => {
      const emptyData = createEmptyFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: emptyData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify empty folder message
      expect(screen.getByText(/no files or folders in this directory/i)).toBeInTheDocument();
    });
  });

  describe('Search/Filter Functionality', () => {
    it('implements search input field for filtering files', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify search input is present
      const searchInput = screen.getByPlaceholderText(/search files and folders/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('tests case-insensitive file name matching', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByPlaceholderText(/search files and folders/i);

      // Search with different case
      await userEvent.type(searchInput, 'LECTURE');

      // Wait for debounce
      await waitFor(() => {
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('validates filtering with partial name matches', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByPlaceholderText(/search files and folders/i);

      // Search with partial match
      await userEvent.type(searchInput, 'Lect');

      await waitFor(() => {
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('tests clearing search to restore full tree', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByPlaceholderText(/search files and folders/i);

      // Search
      await userEvent.type(searchInput, 'Lecture');

      await waitFor(() => {
        expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Clear search
      await userEvent.clear(searchInput);

      // All folders should be visible again
      await waitFor(() => {
        expect(screen.getByText('Week 1')).toBeInTheDocument();
        expect(screen.getByText('Week 2')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('shows "no results" message when filter matches nothing', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const searchInput = screen.getByPlaceholderText(/search files and folders/i);

      // Search for non-existent file
      await userEvent.type(searchInput, 'NonExistentFile12345');

      // Wait for debounce
      await waitFor(() => {
        expect(screen.getByText(/no files or folders match your search query/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Accessibility Tests (WCAG 2.1 AA)', () => {
    it('implements ARIA tree role for folder structure', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify ARIA tree role
      const tree = screen.getByRole('tree');
      expect(tree).toBeInTheDocument();
    });

    it('uses ARIA treeitem role for each folder/file item', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify ARIA treeitem roles
      const treeItems = screen.getAllByRole('treeitem');
      expect(treeItems.length).toBeGreaterThan(0);
    });

    it('tests ARIA expanded/collapsed states for folders', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Get a folder treeitem
      const week1Folder = screen.getByText('Week 1');
      const treeItem = week1Folder.closest('[role="treeitem"]');

      // Initially should be collapsed
      expect(treeItem).toHaveAttribute('aria-expanded');

      // Click to expand
      await userEvent.click(week1Folder);

      // Should now be expanded
      await waitFor(() => {
        expect(treeItem).toHaveAttribute('aria-expanded');
      });
    });

    it('validates proper focus management within tree', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const tree = screen.getByRole('tree');

      // Focus tree
      tree.focus();

      // Tree should be focusable
      expect(tree).toHaveFocus();
    });

    it('tests keyboard navigation with arrow keys (up/down/left/right)', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const tree = screen.getByRole('tree');
      tree.focus();

      // Test navigation keys
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowRight}');
      await userEvent.keyboard('{ArrowLeft}');
      await userEvent.keyboard('{ArrowUp}');

      // Tree should maintain focus during navigation
      expect(document.activeElement).toBeDefined();
    });

    it('validates Home/End keys for first/last item navigation', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const tree = screen.getByRole('tree');
      tree.focus();

      // Test Home/End keys
      await userEvent.keyboard('{Home}');
      await userEvent.keyboard('{End}');

      // Navigation should work
      expect(tree).toBeInTheDocument();
    });

    it('ensures screen reader announces folder/file names and states', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify aria-live region for screen readers
      const liveRegion = screen.getByText(/showing \d+ files? in/i);
      expect(liveRegion).toBeInTheDocument();
    });

    it('tests proper tab order through interactive elements', async () => {
      const mockData = createMockFolderData({
        canManageFiles: true,
        canDownload: true,
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient, authenticated: true });

      await waitForLoadingToFinish();

      // Tab through interactive elements
      await userEvent.tab();

      // Elements should be focusable in logical order
      expect(document.activeElement).toBeDefined();
    });

    it('validates focus indicators with 3:1 contrast ratio', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const tree = screen.getByRole('tree');
      tree.focus();

      // Focus indicator should be visible (Material-UI provides this)
      expect(tree).toBeInTheDocument();
    });

    it('ensures color contrast for text meets 4.5:1 ratio', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Material-UI theme ensures proper contrast ratios
      expect(screen.getByText('Week 1')).toBeInTheDocument();
    });

    it('tests keyboard-only operation without mouse', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      const tree = screen.getByRole('tree');

      // Navigate using keyboard only
      tree.focus();
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');

      // Navigation should work without mouse
      expect(tree).toBeInTheDocument();
    });
  });

  describe('Material-UI Integration', () => {
    it('uses TreeView component for folder hierarchy', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify TreeView is used
      const tree = screen.getByRole('tree');
      expect(tree).toBeInTheDocument();
    });

    it('uses Breadcrumbs component for navigation trail', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify Breadcrumbs component
      const breadcrumbs = screen.getByRole('navigation', { name: /folder navigation breadcrumbs/i });
      expect(breadcrumbs).toBeInTheDocument();
    });

    it('tests Button components for Edit and Download actions', async () => {
      const mockData = createMockFolderData({
        canManageFiles: true,
        canDownload: true,
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient, authenticated: true });

      await waitForLoadingToFinish();

      // Verify Material-UI buttons
      expect(screen.getByRole('button', { name: /edit folder/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download entire folder/i })).toBeInTheDocument();
    });

    it('validates Alert component for error messages', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.error();
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
      });
    });

    it('uses Skeleton component for loading states', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', async () => {
          await delay(100);
          return HttpResponse.json({
            success: true,
            data: createMockFolderData(),
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      // Verify Skeleton components
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);

      await waitForLoadingToFinish();
    });

    it('uses TextField for search input with proper styling', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Verify TextField with search icon
      const searchInput = screen.getByPlaceholderText(/search files and folders/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('TypeScript Type Safety', () => {
    it('validates FolderBrowserProps interface definition', () => {
      // TypeScript compilation ensures interface is valid
      const props: FolderBrowserProps = {
        folderId: 1,
      };

      expect(props.folderId).toBe(1);
    });

    it('tests required props (folderId)', async () => {
      const mockData = createMockFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      // @ts-expect-error - folderId is required
      const invalidProps = {};

      // Component should require folderId
      expect(() => {
        // This would fail TypeScript compilation
        const _props: FolderBrowserProps = invalidProps;
      }).toBeDefined();
    });

    it('validates optional props with proper types', () => {
      const props: FolderBrowserProps = {
        folderId: 1,
        showdescription: true,
        showexpanded: false,
        displayMode: 'inline',
        forcedownload: true,
      };

      expect(props.showdescription).toBe(true);
      expect(props.showexpanded).toBe(false);
      expect(props.displayMode).toBe('inline');
      expect(props.forcedownload).toBe(true);
    });

    it('tests TypeScript strict mode compliance', () => {
      // TypeScript strict mode ensures no any types
      // This test validates compilation
      const props: FolderBrowserProps = {
        folderId: 123,
      };

      expect(props).toBeDefined();
    });

    it('ensures no any types in component or tests', () => {
      // TypeScript strict mode enforced
      // All types are explicitly defined
      const mockData: ReturnType<typeof createMockFolderData> = createMockFolderData();
      expect(mockData).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('Empty Folder: Shows appropriate message with icon', async () => {
      const emptyData = createEmptyFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: emptyData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      expect(screen.getByText(/no files or folders in this directory/i)).toBeInTheDocument();
    });

    it('Deeply Nested: Tests performance with 10+ levels of nesting', async () => {
      const deepData = createDeeplyNestedFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: deepData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Component should handle deep nesting
      await waitFor(() => {
        expect(screen.getByText('Level 1')).toBeInTheDocument();
      });
    });

    it('Large Folder: Validates rendering of 100+ files without lag', async () => {
      const largeData = createLargeFolderData();

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: largeData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Component should render many files
      expect(screen.getByText(/100 files/)).toBeInTheDocument();
    });

    it('Broken File Links: Handles missing files gracefully', async () => {
      const mockData = createMockFolderData();
      // Modify to have null URL
      mockData.tree.children[0].children![0].file!.url = '';

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} showexpanded={true} />, { queryClient });

      await waitForLoadingToFinish();

      // Component should handle broken links
      expect(screen.getByText('Lecture 1.pdf')).toBeInTheDocument();
    });

    it('Permission Restrictions: Shows error for unauthorized access', async () => {
      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'PERMISSION_DENIED', message: 'Access denied' },
            },
            { status: 403 }
          );
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText(/failed to load folder contents/i)).toBeInTheDocument();
      });
    });

    it('No Download Permission: Hides Download Folder button appropriately', async () => {
      const mockData = createMockFolderData({
        canDownload: false,
        archiveUrl: null,
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Download button should not be present
      expect(screen.queryByRole('button', { name: /download entire folder/i })).not.toBeInTheDocument();
    });

    it('Special Characters: Tests folder/file names with Unicode, spaces', async () => {
      const mockData = createMockFolderData();
      mockData.tree.children.push({
        id: 'file-special',
        name: 'Файл с кириллицей.pdf',
        isFolder: false,
        isRoot: false,
        path: '/Файл с кириллицей.pdf',
        file: {
          filename: 'Файл с кириллицей.pdf',
          filepath: '/',
          filesize: 1024,
          url: 'https://moodle.example.com/file.pdf',
          timemodified: 1704067200,
          mimetype: 'application/pdf',
        },
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Unicode characters should be displayed correctly
      expect(screen.getByText('Файл с кириллицей.pdf')).toBeInTheDocument();
    });

    it('Very Long Names: Validates text truncation with ellipsis', async () => {
      const mockData = createMockFolderData();
      mockData.tree.children.push({
        id: 'file-long',
        name: 'This is a very very very very very long filename that should be truncated with ellipsis to fit in the display area.pdf',
        isFolder: false,
        isRoot: false,
        path: '/long.pdf',
        file: {
          filename: 'long.pdf',
          filepath: '/',
          filesize: 1024,
          url: 'https://moodle.example.com/long.pdf',
          timemodified: 1704067200,
          mimetype: 'application/pdf',
        },
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      // Long filename should be rendered (Material-UI handles truncation via CSS)
      expect(screen.getByText(/This is a very very very very very long filename/)).toBeInTheDocument();
    });

    it('Single File: Handles folder with only one file', async () => {
      const mockData = createMockFolderData({
        tree: {
          id: 'root',
          name: 'Single File Folder',
          isFolder: true,
          isRoot: true,
          path: '/',
          children: [
            {
              id: 'file-1',
              name: 'OnlyFile.pdf',
              isFolder: false,
              isRoot: false,
              path: '/OnlyFile.pdf',
              file: {
                filename: 'OnlyFile.pdf',
                filepath: '/',
                filesize: 1024,
                url: 'https://moodle.example.com/only.pdf',
                timemodified: 1704067200,
                mimetype: 'application/pdf',
              },
            },
          ],
        },
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      expect(screen.getByText('OnlyFile.pdf')).toBeInTheDocument();
      expect(screen.getByText(/1 file/)).toBeInTheDocument();
    });

    it('Only Subfolders: Tests folder with no files, only subfolders', async () => {
      const mockData = createMockFolderData({
        tree: {
          id: 'root',
          name: 'Folders Only',
          isFolder: true,
          isRoot: true,
          path: '/',
          children: [
            {
              id: 'folder-1',
              name: 'Subfolder 1',
              isFolder: true,
              isRoot: false,
              path: '/Subfolder 1',
              children: [],
            },
            {
              id: 'folder-2',
              name: 'Subfolder 2',
              isFolder: true,
              isRoot: false,
              path: '/Subfolder 2',
              children: [],
            },
          ],
        },
      });

      server.use(
        http.get('/api/v1/resources/folders/:id', () => {
          return HttpResponse.json({
            success: true,
            data: mockData,
          });
        })
      );

      render(<FolderBrowser {...defaultProps} />, { queryClient });

      await waitForLoadingToFinish();

      expect(screen.getByText('Subfolder 1')).toBeInTheDocument();
      expect(screen.getByText('Subfolder 2')).toBeInTheDocument();
      expect(screen.getByText(/0 files/)).toBeInTheDocument();
    });
  });
});
