/**
 * MSW Request Handlers for Resource Activity API Endpoints
 * 
 * This file provides Mock Service Worker (MSW) handlers for resource activity
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 * 
 * Handlers include:
 * - GET /api/v1/resources/:id - Get resource details
 * 
 * @package    react-frontend
 * @subpackage tests/mocks/handlers
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { http, HttpResponse } from 'msw';
import { ResourceDisplayType } from '@/features/activities/resources/types/resource.types';
import { createMockResourceFile } from '@tests/helpers/mockData';

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Default mock resource data for testing
 * Uses createMockResourceFile factory for consistent data structure matching ResourceFile interface
 */
const mockResourceData: Record<number, any> = {
  1: createMockResourceFile({
    id: 1,
    name: 'Course Syllabus PDF',
    intro: '<p>This is the <strong>course syllabus</strong>. Please read it carefully.</p>',
    files: [
      {
        filename: 'syllabus.pdf',
        filepath: '/',
        filesize: 245680,
        url: 'https://moodle.example.com/pluginfile.php/123/mod_resource/content/1/syllabus.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  2: createMockResourceFile({
    id: 2,
    name: 'Lecture Slides',
    intro: '<p>PowerPoint presentation from Week 1 lecture</p>',
    display: ResourceDisplayType.DOWNLOAD,
    files: [
      {
        filename: 'week1-lecture.pptx',
        filepath: '/',
        filesize: 3456789,
        url: 'https://moodle.example.com/pluginfile.php/124/mod_resource/content/1/week1-lecture.pptx',
        timemodified: 1700000000,
        mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    ],
  }),
  3: createMockResourceFile({
    id: 3,
    name: 'Empty Resource (No Files)',
    intro: '<p>This resource has no content files attached</p>',
    files: [],
  }),
  4: createMockResourceFile({
    id: 4,
    name: 'To Be Migrated Resource',
    intro: '<p>Legacy resource requiring migration</p>',
    tobemigrated: 1,
    legacyfiles: 1,
    legacyfileslast: 1600000000,
    files: [],
    timemodified: 1600000000,
  }),
  5: createMockResourceFile({
    id: 5,
    name: 'Embedded Video Resource',
    intro: '<p>Video to be embedded in the page</p>',
    display: ResourceDisplayType.EMBED,
    displayoptions: '{"width":800,"height":600,"printintro":1}',
    files: [
      {
        filename: 'lecture-video.mp4',
        filepath: '/',
        filesize: 52428800, // 50 MB
        url: 'https://moodle.example.com/pluginfile.php/125/mod_resource/content/1/lecture-video.mp4',
        timemodified: 1700000000,
        mimetype: 'video/mp4',
      },
    ],
  }),
  6: createMockResourceFile({
    id: 6,
    name: 'Open in New Tab Resource',
    intro: '<p>Document that opens in a new tab</p>',
    display: ResourceDisplayType.NEW,
    files: [
      {
        filename: 'guidelines.docx',
        filepath: '/',
        filesize: 123456,
        url: 'https://moodle.example.com/pluginfile.php/126/mod_resource/content/1/guidelines.docx',
        timemodified: 1700000000,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
  }),
  
  // Test resources for union type validation (IDs 61-67)
  // Each resource tests a different display mode (0-6)
  61: createMockResourceFile({
    id: 61,
    name: 'Display Mode AUTO (0)',
    intro: '<p>Test resource for AUTO display mode</p>',
    display: 0, // ResourceDisplayType.AUTO
    files: [
      {
        filename: 'auto-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/161/mod_resource/content/1/auto-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  62: createMockResourceFile({
    id: 62,
    name: 'Display Mode EMBED (1)',
    intro: '<p>Test resource for EMBED display mode</p>',
    display: 1, // ResourceDisplayType.EMBED
    files: [
      {
        filename: 'embed-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/162/mod_resource/content/1/embed-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  63: createMockResourceFile({
    id: 63,
    name: 'Display Mode FRAME (2)',
    intro: '<p>Test resource for FRAME display mode</p>',
    display: 2, // ResourceDisplayType.FRAME
    files: [
      {
        filename: 'frame-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/163/mod_resource/content/1/frame-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  64: createMockResourceFile({
    id: 64,
    name: 'Display Mode NEW (3)',
    intro: '<p>Test resource for NEW display mode</p>',
    display: 3, // ResourceDisplayType.NEW
    files: [
      {
        filename: 'new-display.docx',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/164/mod_resource/content/1/new-display.docx',
        timemodified: 1700000000,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
  }),
  65: createMockResourceFile({
    id: 65,
    name: 'Display Mode DOWNLOAD (4)',
    intro: '<p>Test resource for DOWNLOAD display mode</p>',
    display: 4, // ResourceDisplayType.DOWNLOAD
    files: [
      {
        filename: 'download-display.zip',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/165/mod_resource/content/1/download-display.zip',
        timemodified: 1700000000,
        mimetype: 'application/zip',
      },
    ],
  }),
  66: createMockResourceFile({
    id: 66,
    name: 'Display Mode OPEN (5)',
    intro: '<p>Test resource for OPEN display mode</p>',
    display: 5, // ResourceDisplayType.OPEN
    files: [
      {
        filename: 'open-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/166/mod_resource/content/1/open-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  67: createMockResourceFile({
    id: 67,
    name: 'Display Mode POPUP (6)',
    intro: '<p>Test resource for POPUP display mode</p>',
    display: 6, // ResourceDisplayType.POPUP
    files: [
      {
        filename: 'popup-display.pdf',
        filepath: '/',
        filesize: 50000,
        url: 'https://moodle.example.com/pluginfile.php/167/mod_resource/content/1/popup-display.pdf',
        timemodified: 1700000000,
        mimetype: 'application/pdf',
      },
    ],
  }),
  
  // Test resource for very large file size (ID 75)
  75: createMockResourceFile({
    id: 75,
    name: 'Large File Resource',
    intro: '<p>Test resource with file >1GB</p>',
    display: 0,
    files: [
      {
        filename: 'largefile.iso',
        filepath: '/',
        filesize: 2147483648, // 2 GB
        mimetype: 'application/octet-stream',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/175/mod_resource/content/1/largefile.iso',
      },
    ],
  }),
  
  // Test resources for concurrent resourceId prop changes (IDs 80-81)
  80: createMockResourceFile({
    id: 80,
    name: 'Resource 1',
    intro: '<p>First resource for concurrent test</p>',
    display: 0,
    files: [
      {
        filename: 'resource1.pdf',
        filepath: '/',
        filesize: 50000,
        mimetype: 'application/pdf',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/180/mod_resource/content/1/resource1.pdf',
      },
    ],
  }),
  81: createMockResourceFile({
    id: 81,
    name: 'Resource 2',
    intro: '<p>Second resource for concurrent test</p>',
    display: 0,
    files: [
      {
        filename: 'resource2.pdf',
        filepath: '/',
        filesize: 50000,
        mimetype: 'application/pdf',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/181/mod_resource/content/1/resource2.pdf',
      },
    ],
  }),
};

/**
 * Mock folder data for testing FolderBrowser component
 * Includes various folder structures: empty, nested, large, with special characters
 */
const mockFolderData: Record<number, any> = {
  // Basic folder with files and subfolders
  1: {
    id: 1,
    coursemodule: 101,
    course: 1,
    name: 'Course Materials',
    intro: '<p>This folder contains all course materials organized by topic</p>',
    introformat: 1,
    introfiles: [],
    section: 1,
    visible: 1,
    groupmode: 0,
    groupingid: 0,
    type: 'folder',
    revision: 1,
    display: 0,
    showexpanded: 1,
    showdownloadfolder: 1,
    canManageFiles: true,
    canDownload: true,
    archiveUrl: 'https://moodle.example.com/pluginfile.php/101/mod_folder/download_folder/0/folder.zip',
    editUrl: '/course/modedit.php?update=101',
    files: [
      {
        filename: 'syllabus.pdf',
        filepath: '/',
        filesize: 245680,
        mimetype: 'application/pdf',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/syllabus.pdf',
      },
      {
        filename: 'lecture01.pdf',
        filepath: '/lectures/',
        filesize: 1234567,
        mimetype: 'application/pdf',
        timemodified: 1700100000,
        url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/lectures/lecture01.pdf',
      },
      {
        filename: 'lecture02.pdf',
        filepath: '/lectures/',
        filesize: 1345678,
        mimetype: 'application/pdf',
        timemodified: 1700200000,
        url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/lectures/lecture02.pdf',
      },
      {
        filename: 'assignment01.docx',
        filepath: '/assignments/',
        filesize: 56789,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        timemodified: 1700300000,
        url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/assignments/assignment01.docx',
      },
      {
        filename: 'reading01.pdf',
        filepath: '/readings/',
        filesize: 987654,
        mimetype: 'application/pdf',
        timemodified: 1700400000,
        url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/readings/reading01.pdf',
      },
      {
        filename: 'thumbnail.jpg',
        filepath: '/images/',
        filesize: 45678,
        mimetype: 'image/jpeg',
        timemodified: 1700500000,
        url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/images/thumbnail.jpg',
      },
    ],
    tree: {
      id: 'root',
      name: 'Course Materials',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: [
        {
          id: 'file-syllabus',
          name: 'syllabus.pdf',
          isFolder: false,
          path: '/syllabus.pdf',
          parentPath: '/',
          file: {
            filename: 'syllabus.pdf',
            filepath: '/',
            filesize: 245680,
            mimetype: 'application/pdf',
            timemodified: 1700000000,
            url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/syllabus.pdf',
          },
        },
        {
          id: 'folder-lectures',
          name: 'lectures',
          isFolder: true,
          path: '/lectures/',
          parentPath: '/',
          children: [
            {
              id: 'file-lecture01',
              name: 'lecture01.pdf',
              isFolder: false,
              path: '/lectures/lecture01.pdf',
              parentPath: '/lectures/',
              file: {
                filename: 'lecture01.pdf',
                filepath: '/lectures/',
                filesize: 1234567,
                mimetype: 'application/pdf',
                timemodified: 1700100000,
                url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/lectures/lecture01.pdf',
              },
            },
            {
              id: 'file-lecture02',
              name: 'lecture02.pdf',
              isFolder: false,
              path: '/lectures/lecture02.pdf',
              parentPath: '/lectures/',
              file: {
                filename: 'lecture02.pdf',
                filepath: '/lectures/',
                filesize: 1345678,
                mimetype: 'application/pdf',
                timemodified: 1700200000,
                url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/lectures/lecture02.pdf',
              },
            },
          ],
        },
        {
          id: 'folder-assignments',
          name: 'assignments',
          isFolder: true,
          path: '/assignments/',
          parentPath: '/',
          children: [
            {
              id: 'file-assignment01',
              name: 'assignment01.docx',
              isFolder: false,
              path: '/assignments/assignment01.docx',
              parentPath: '/assignments/',
              file: {
                filename: 'assignment01.docx',
                filepath: '/assignments/',
                filesize: 56789,
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                timemodified: 1700300000,
                url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/assignments/assignment01.docx',
              },
            },
          ],
        },
        {
          id: 'folder-readings',
          name: 'readings',
          isFolder: true,
          path: '/readings/',
          parentPath: '/',
          children: [
            {
              id: 'file-reading01',
              name: 'reading01.pdf',
              isFolder: false,
              path: '/readings/reading01.pdf',
              parentPath: '/readings/',
              file: {
                filename: 'reading01.pdf',
                filepath: '/readings/',
                filesize: 987654,
                mimetype: 'application/pdf',
                timemodified: 1700400000,
                url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/readings/reading01.pdf',
              },
            },
          ],
        },
        {
          id: 'folder-images',
          name: 'images',
          isFolder: true,
          path: '/images/',
          parentPath: '/',
          children: [
            {
              id: 'file-thumbnail',
              name: 'thumbnail.jpg',
              isFolder: false,
              path: '/images/thumbnail.jpg',
              parentPath: '/images/',
              file: {
                filename: 'thumbnail.jpg',
                filepath: '/images/',
                filesize: 45678,
                mimetype: 'image/jpeg',
                timemodified: 1700500000,
                url: 'https://moodle.example.com/pluginfile.php/101/mod_folder/content/1/images/thumbnail.jpg',
              },
            },
          ],
        },
      ],
    },
  },
  
  // Empty folder
  2: {
    id: 2,
    coursemodule: 102,
    course: 1,
    name: 'Empty Folder',
    intro: '<p>This folder has no files yet</p>',
    introformat: 1,
    introfiles: [],
    section: 1,
    visible: 1,
    groupmode: 0,
    groupingid: 0,
    type: 'folder',
    revision: 1,
    display: 0,
    showexpanded: 1,
    showdownloadfolder: 0,
    canManageFiles: true,
    canDownload: false,
    editUrl: '/course/modedit.php?update=102',
    files: [],
    tree: {
      id: 'root',
      name: 'Empty Folder',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: [],
    },
  },
  
  // Deeply nested folder structure (5+ levels)
  3: {
    id: 3,
    coursemodule: 103,
    course: 1,
    name: 'Deeply Nested Structure',
    intro: '<p>This folder has multiple levels of nesting</p>',
    introformat: 1,
    introfiles: [],
    section: 1,
    visible: 1,
    groupmode: 0,
    groupingid: 0,
    type: 'folder',
    revision: 1,
    display: 0,
    showexpanded: 0,
    showdownloadfolder: 1,
    canManageFiles: false,
    canDownload: true,
    archiveUrl: 'https://moodle.example.com/pluginfile.php/103/mod_folder/download_folder/0/folder.zip',
    files: [
      {
        filename: 'deepfile.txt',
        filepath: '/level1/level2/level3/level4/level5/',
        filesize: 1024,
        mimetype: 'text/plain',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/103/mod_folder/content/1/level1/level2/level3/level4/level5/deepfile.txt',
      },
    ],
    tree: {
      id: 'root',
      name: 'Deeply Nested Structure',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: [
        {
          id: 'folder-level1',
          name: 'level1',
          isFolder: true,
          path: '/level1/',
          parentPath: '/',
          children: [
            {
              id: 'folder-level2',
              name: 'level2',
              isFolder: true,
              path: '/level1/level2/',
              parentPath: '/level1/',
              children: [
                {
                  id: 'folder-level3',
                  name: 'level3',
                  isFolder: true,
                  path: '/level1/level2/level3/',
                  parentPath: '/level1/level2/',
                  children: [
                    {
                      id: 'folder-level4',
                      name: 'level4',
                      isFolder: true,
                      path: '/level1/level2/level3/level4/',
                      parentPath: '/level1/level2/level3/',
                      children: [
                        {
                          id: 'folder-level5',
                          name: 'level5',
                          isFolder: true,
                          path: '/level1/level2/level3/level4/level5/',
                          parentPath: '/level1/level2/level3/level4/',
                          children: [
                            {
                              id: 'file-deepfile',
                              name: 'deepfile.txt',
                              isFolder: false,
                              path: '/level1/level2/level3/level4/level5/deepfile.txt',
                              parentPath: '/level1/level2/level3/level4/level5/',
                              file: {
                                filename: 'deepfile.txt',
                                filepath: '/level1/level2/level3/level4/level5/',
                                filesize: 1024,
                                mimetype: 'text/plain',
                                timemodified: 1700000000,
                                url: 'https://moodle.example.com/pluginfile.php/103/mod_folder/content/1/level1/level2/level3/level4/level5/deepfile.txt',
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  
  // Folder with special characters and long names
  4: {
    id: 4,
    coursemodule: 104,
    course: 1,
    name: 'Special Characters & Long Names',
    intro: '<p>Testing Unicode characters and very long file names</p>',
    introformat: 1,
    introfiles: [],
    section: 1,
    visible: 1,
    groupmode: 0,
    groupingid: 0,
    type: 'folder',
    revision: 1,
    display: 0,
    showexpanded: 1,
    showdownloadfolder: 1,
    canManageFiles: true,
    canDownload: true,
    archiveUrl: 'https://moodle.example.com/pluginfile.php/104/mod_folder/download_folder/0/folder.zip',
    editUrl: '/course/modedit.php?update=104',
    files: [
      {
        filename: 'файл с кириллицей.pdf',
        filepath: '/',
        filesize: 123456,
        mimetype: 'application/pdf',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/104/mod_folder/content/1/файл%20с%20кириллицей.pdf',
      },
      {
        filename: 'This is a very long filename that should be truncated in the UI to prevent layout issues and ensure proper display on mobile devices.pdf',
        filepath: '/',
        filesize: 234567,
        mimetype: 'application/pdf',
        timemodified: 1700100000,
        url: 'https://moodle.example.com/pluginfile.php/104/mod_folder/content/1/This%20is%20a%20very%20long%20filename.pdf',
      },
      {
        filename: '日本語ファイル.docx',
        filepath: '/',
        filesize: 345678,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        timemodified: 1700200000,
        url: 'https://moodle.example.com/pluginfile.php/104/mod_folder/content/1/日本語ファイル.docx',
      },
    ],
    tree: {
      id: 'root',
      name: 'Special Characters & Long Names',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: [
        {
          id: 'file-cyrillic',
          name: 'файл с кириллицей.pdf',
          isFolder: false,
          path: '/файл с кириллицей.pdf',
          parentPath: '/',
          file: {
            filename: 'файл с кириллицей.pdf',
            filepath: '/',
            filesize: 123456,
            mimetype: 'application/pdf',
            timemodified: 1700000000,
            url: 'https://moodle.example.com/pluginfile.php/104/mod_folder/content/1/файл%20с%20кириллицей.pdf',
          },
        },
        {
          id: 'file-longname',
          name: 'This is a very long filename that should be truncated in the UI to prevent layout issues and ensure proper display on mobile devices.pdf',
          isFolder: false,
          path: '/This is a very long filename that should be truncated in the UI to prevent layout issues and ensure proper display on mobile devices.pdf',
          parentPath: '/',
          file: {
            filename: 'This is a very long filename that should be truncated in the UI to prevent layout issues and ensure proper display on mobile devices.pdf',
            filepath: '/',
            filesize: 234567,
            mimetype: 'application/pdf',
            timemodified: 1700100000,
            url: 'https://moodle.example.com/pluginfile.php/104/mod_folder/content/1/This%20is%20a%20very%20long%20filename.pdf',
          },
        },
        {
          id: 'file-japanese',
          name: '日本語ファイル.docx',
          isFolder: false,
          path: '/日本語ファイル.docx',
          parentPath: '/',
          file: {
            filename: '日本語ファイル.docx',
            filepath: '/',
            filesize: 345678,
            mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            timemodified: 1700200000,
            url: 'https://moodle.example.com/pluginfile.php/104/mod_folder/content/1/日本語ファイル.docx',
          },
        },
      ],
    },
  },
  
  // Folder with only subfolders (no files at root)
  5: {
    id: 5,
    coursemodule: 105,
    course: 1,
    name: 'Only Subfolders',
    intro: '<p>This folder contains only subfolders, no files at root level</p>',
    introformat: 1,
    introfiles: [],
    section: 1,
    visible: 1,
    groupmode: 0,
    groupingid: 0,
    type: 'folder',
    revision: 1,
    display: 0,
    showexpanded: 1,
    showdownloadfolder: 1,
    canManageFiles: true,
    canDownload: true,
    archiveUrl: 'https://moodle.example.com/pluginfile.php/105/mod_folder/download_folder/0/folder.zip',
    editUrl: '/course/modedit.php?update=105',
    files: [
      {
        filename: 'file1.pdf',
        filepath: '/subfolder1/',
        filesize: 111111,
        mimetype: 'application/pdf',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/105/mod_folder/content/1/subfolder1/file1.pdf',
      },
      {
        filename: 'file2.pdf',
        filepath: '/subfolder2/',
        filesize: 222222,
        mimetype: 'application/pdf',
        timemodified: 1700100000,
        url: 'https://moodle.example.com/pluginfile.php/105/mod_folder/content/1/subfolder2/file2.pdf',
      },
    ],
    tree: {
      id: 'root',
      name: 'Only Subfolders',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: [
        {
          id: 'folder-subfolder1',
          name: 'subfolder1',
          isFolder: true,
          path: '/subfolder1/',
          parentPath: '/',
          children: [
            {
              id: 'file-file1',
              name: 'file1.pdf',
              isFolder: false,
              path: '/subfolder1/file1.pdf',
              parentPath: '/subfolder1/',
              file: {
                filename: 'file1.pdf',
                filepath: '/subfolder1/',
                filesize: 111111,
                mimetype: 'application/pdf',
                timemodified: 1700000000,
                url: 'https://moodle.example.com/pluginfile.php/105/mod_folder/content/1/subfolder1/file1.pdf',
              },
            },
          ],
        },
        {
          id: 'folder-subfolder2',
          name: 'subfolder2',
          isFolder: true,
          path: '/subfolder2/',
          parentPath: '/',
          children: [
            {
              id: 'file-file2',
              name: 'file2.pdf',
              isFolder: false,
              path: '/subfolder2/file2.pdf',
              parentPath: '/subfolder2/',
              file: {
                filename: 'file2.pdf',
                filepath: '/subfolder2/',
                filesize: 222222,
                mimetype: 'application/pdf',
                timemodified: 1700100000,
                url: 'https://moodle.example.com/pluginfile.php/105/mod_folder/content/1/subfolder2/file2.pdf',
              },
            },
          ],
        },
      ],
    },
  },
  
  // Folder with single file
  6: {
    id: 6,
    coursemodule: 106,
    course: 1,
    name: 'Single File Folder',
    intro: '<p>This folder contains only one file</p>',
    introformat: 1,
    introfiles: [],
    section: 1,
    visible: 1,
    groupmode: 0,
    groupingid: 0,
    type: 'folder',
    revision: 1,
    display: 0,
    showexpanded: 1,
    showdownloadfolder: 1,
    canManageFiles: true,
    canDownload: true,
    archiveUrl: 'https://moodle.example.com/pluginfile.php/106/mod_folder/download_folder/0/folder.zip',
    editUrl: '/course/modedit.php?update=106',
    files: [
      {
        filename: 'onlyfile.pdf',
        filepath: '/',
        filesize: 555555,
        mimetype: 'application/pdf',
        timemodified: 1700000000,
        url: 'https://moodle.example.com/pluginfile.php/106/mod_folder/content/1/onlyfile.pdf',
      },
    ],
    tree: {
      id: 'root',
      name: 'Single File Folder',
      isFolder: true,
      isRoot: true,
      path: '/',
      children: [
        {
          id: 'file-onlyfile',
          name: 'onlyfile.pdf',
          isFolder: false,
          path: '/onlyfile.pdf',
          parentPath: '/',
          file: {
            filename: 'onlyfile.pdf',
            filepath: '/',
            filesize: 555555,
            mimetype: 'application/pdf',
            timemodified: 1700000000,
            url: 'https://moodle.example.com/pluginfile.php/106/mod_folder/content/1/onlyfile.pdf',
          },
        },
      ],
    },
  },
};

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * GET /api/v1/resources/:id
 * 
 * Retrieves details for a specific resource activity.
 * 
 * URL Parameters:
 * - id: Resource ID
 * 
 * Response:
 * - 200: Resource data with success envelope
 * - 404: Resource not found
 * - 403: Permission denied (for resource ID 999)
 */
const getResource = http.get('*/api/v1/resources/:id', ({ params, request }) => {
  console.log('[MSW Resources] Handler called with URL:', request.url);
  console.log('[MSW Resources] Params:', params);
  const resourceId = Number(params.id);
  console.log('[MSW Resources] Parsed resourceId:', resourceId);

  // Simulate permission denied for testing
  if (resourceId === 999) {
    console.log('[MSW Resources] Returning 403 permission denied');
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to view this resource',
          details: {
            required_capability: 'mod/resource:view',
            context: 'course',
          },
        },
      },
      { status: 403 }
    );
  }

  // Check if resource exists
  const resource = mockResourceData[resourceId];
  console.log('[MSW Resources] Resource found:', !!resource);
  if (!resource) {
    console.log('[MSW Resources] Returning 404 not found');
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Resource not found',
          details: {
            resourceId,
          },
        },
      },
      { status: 404 }
    );
  }

  // Return successful response
  console.log('[MSW Resources] Returning 200 success with resource:', resource.name);
  return HttpResponse.json({
    success: true,
    data: resource,
  });
});

/**
 * GET /api/v1/resources/folders/:id
 * 
 * Retrieves folder resource with hierarchical tree structure.
 * 
 * URL Parameters:
 * - id: Folder ID
 * 
 * Response:
 * - 200: Folder data with file tree structure
 * - 404: Folder not found
 * - 403: Permission denied (for folder ID 999)
 */
const getFolder = http.get('*/api/v1/resources/folders/:id', ({ params, request }) => {
  console.log('[MSW Folders] Handler called with URL:', request.url);
  console.log('[MSW Folders] Params:', params);
  const folderId = Number(params.id);
  console.log('[MSW Folders] Parsed folderId:', folderId);

  // Simulate permission denied for testing
  if (folderId === 999) {
    console.log('[MSW Folders] Returning 403 permission denied');
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to access this folder',
          details: {
            required_capability: 'mod/folder:view',
            context: 'course',
          },
        },
      },
      { status: 403 }
    );
  }

  // Check if folder exists
  const folder = mockFolderData[folderId];
  console.log('[MSW Folders] Folder found:', !!folder);
  if (!folder) {
    console.log('[MSW Folders] Returning 404 not found');
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Folder resource not found',
          details: {
            folderId,
          },
        },
      },
      { status: 404 }
    );
  }

  // Return successful response
  console.log('[MSW Folders] Returning 200 success with folder:', folder.name);
  return HttpResponse.json({
    success: true,
    data: folder,
  });
});

// ============================================================================
// Handler Array Export
// ============================================================================

/**
 * Array of all resource-related MSW request handlers
 * 
 * These handlers can be added to the MSW server individually or as a group:
 * 
 * @example
 * ```typescript
 * import { resourcesHandlers } from './resources';
 * import { setupServer } from 'msw/node';
 * 
 * const server = setupServer(...resourcesHandlers);
 * ```
 */
export const resourcesHandlers = [getResource, getFolder];

export default resourcesHandlers;
