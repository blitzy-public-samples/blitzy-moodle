import { Page, Locator } from '@playwright/test';

/**
 * Interface representing file metadata
 */
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  modifiedDate: Date;
  createdDate: Date;
  path: string;
  isFolder: boolean;
  thumbnailUrl?: string;
  permissions?: FilePermissions;
}

/**
 * Interface representing file permissions
 */
export interface FilePermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
  owner: string;
  sharedWith?: string[];
}

/**
 * Interface for file upload options
 */
export interface UploadOptions {
  waitForCompletion?: boolean;
  timeout?: number;
}

/**
 * Interface for sort options
 */
export type SortOption = 'name' | 'date' | 'size' | 'type';

/**
 * Page Object Model for File Repository and File Management Interface
 * 
 * Encapsulates all interactions with the file repository system including:
 * - File uploads (via picker and drag-and-drop)
 * - Folder navigation and creation
 * - File operations (rename, delete, move, download)
 * - File permissions management
 * - File preview and metadata viewing
 */
export class FileRepositoryPage {
  readonly page: Page;
  
  // Primary UI locators
  readonly fileList: Locator;
  readonly uploadButton: Locator;
  readonly uploadZone: Locator;
  readonly folderNavigation: Locator;
  readonly filePreviewModal: Locator;
  readonly downloadButton: Locator;
  readonly fileActionsMenu: Locator;
  readonly renameInput: Locator;
  readonly deleteButton: Locator;
  readonly moveButton: Locator;
  readonly filePermissions: Locator;
  readonly uploadProgress: Locator;
  readonly createFolderButton: Locator;
  readonly fileThumbnail: Locator;
  
  // Additional locators for enhanced functionality
  readonly searchInput: Locator;
  readonly sortDropdown: Locator;
  readonly breadcrumbs: Locator;
  readonly fileInfoPanel: Locator;
  readonly permissionsModal: Locator;
  readonly confirmDeleteModal: Locator;
  readonly moveDestinationSelector: Locator;
  readonly uploadProgressBar: Locator;
  readonly uploadCancelButton: Locator;
  readonly folderNameInput: Locator;
  readonly emptyStateMessage: Locator;

  /**
   * Constructor for FileRepositoryPage
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize primary locators
    this.fileList = page.getByTestId('file-list');
    this.uploadButton = page.getByRole('button', { name: /upload|add file/i });
    this.uploadZone = page.getByTestId('upload-drop-zone');
    this.folderNavigation = page.getByTestId('folder-navigation');
    this.filePreviewModal = page.getByRole('dialog', { name: /file preview|view file/i });
    this.downloadButton = page.getByRole('button', { name: /download/i });
    this.fileActionsMenu = page.getByRole('menu', { name: /file actions|more options/i });
    this.renameInput = page.getByLabel(/rename|new name/i);
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    this.moveButton = page.getByRole('button', { name: /move/i });
    this.filePermissions = page.getByTestId('file-permissions');
    this.uploadProgress = page.getByTestId('upload-progress');
    this.createFolderButton = page.getByRole('button', { name: /create folder|new folder/i });
    this.fileThumbnail = page.getByTestId('file-thumbnail');
    
    // Initialize additional locators
    this.searchInput = page.getByRole('searchbox', { name: /search files/i });
    this.sortDropdown = page.getByRole('combobox', { name: /sort by/i });
    this.breadcrumbs = page.getByTestId('breadcrumbs');
    this.fileInfoPanel = page.getByTestId('file-info-panel');
    this.permissionsModal = page.getByRole('dialog', { name: /permissions|sharing/i });
    this.confirmDeleteModal = page.getByRole('dialog', { name: /confirm delete|delete confirmation/i });
    this.moveDestinationSelector = page.getByTestId('move-destination-selector');
    this.uploadProgressBar = page.getByRole('progressbar');
    this.uploadCancelButton = page.getByRole('button', { name: /cancel upload/i });
    this.folderNameInput = page.getByLabel(/folder name/i);
    this.emptyStateMessage = page.getByTestId('empty-state');
  }

  /**
   * Wait for the file repository to fully load
   * @param timeout - Maximum wait time in milliseconds
   */
  async waitForRepository(timeout: number = 10000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
    await this.fileList.waitFor({ state: 'visible', timeout });
  }

  /**
   * Get list of all files in the current directory
   * @returns Array of file information objects
   */
  async getFiles(): Promise<FileInfo[]> {
    await this.fileList.waitFor({ state: 'visible', timeout: 2000 });
    
    const fileElements = await this.fileList.locator('[data-file-item]').all();
    const files: FileInfo[] = [];
    
    for (const element of fileElements) {
      const id = await element.getAttribute('data-file-id') || '';
      const name = await element.getAttribute('data-file-name') || '';
      const size = parseInt(await element.getAttribute('data-file-size') || '0', 10);
      const type = await element.getAttribute('data-file-type') || '';
      const modifiedDateStr = await element.getAttribute('data-modified-date') || '';
      const createdDateStr = await element.getAttribute('data-created-date') || '';
      const path = await element.getAttribute('data-file-path') || '';
      const isFolder = (await element.getAttribute('data-is-folder')) === 'true';
      const thumbnailUrl = await element.getAttribute('data-thumbnail-url') || undefined;
      
      files.push({
        id,
        name,
        size,
        type,
        modifiedDate: new Date(modifiedDateStr),
        createdDate: new Date(createdDateStr),
        path,
        isFolder,
        thumbnailUrl
      });
    }
    
    return files;
  }

  /**
   * Upload a file using the file picker dialog
   * @param filePath - Path to the file to upload
   * @param options - Upload options
   */
  async uploadFile(filePath: string, options: UploadOptions = {}): Promise<void> {
    const { waitForCompletion = true, timeout = 30000 } = options;
    
    // Start waiting for the file chooser before clicking
    const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout });
    
    // Click upload button with short timeout
    await this.uploadButton.click({ timeout: 2000 });
    
    // Wait for file chooser and set files
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    
    if (waitForCompletion) {
      await this.waitForUploadComplete(timeout);
    }
  }

  /**
   * Upload a file using drag and drop
   * @param filePath - Path to the file to upload
   * @param options - Upload options
   */
  async uploadFileByDragDrop(filePath: string, options: UploadOptions = {}): Promise<void> {
    const { waitForCompletion = true, timeout = 30000 } = options;
    
    // Read file and create data transfer
    const buffer = await this.page.evaluate(async (path) => {
      const response = await fetch(path);
      const arrayBuffer = await response.arrayBuffer();
      return Array.from(new Uint8Array(arrayBuffer));
    }, filePath);
    
    // Get file name from path
    const fileName = filePath.split('/').pop() || 'file';
    
    // Create data transfer with file
    await this.uploadZone.evaluate((element, { buffer, fileName }) => {
      const file = new File([new Uint8Array(buffer)], fileName);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer
      });
      
      element.dispatchEvent(dropEvent);
    }, { buffer, fileName });
    
    if (waitForCompletion) {
      await this.waitForUploadComplete(timeout);
    }
  }

  /**
   * Upload multiple files at once
   * @param filePaths - Array of file paths to upload
   * @param options - Upload options
   */
  async uploadMultipleFiles(filePaths: string[], options: UploadOptions = {}): Promise<void> {
    const { waitForCompletion = true, timeout = 60000 } = options;
    
    // Start waiting for the file chooser before clicking
    const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout });
    
    // Click upload button with short timeout
    await this.uploadButton.click({ timeout: 2000 });
    
    // Wait for file chooser and set multiple files
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePaths);
    
    if (waitForCompletion) {
      await this.waitForUploadComplete(timeout);
    }
  }

  /**
   * Download a file by its ID
   * @param fileId - The ID of the file to download
   */
  async downloadFile(fileId: string): Promise<void> {
    // Locate the file and click its download button
    const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
    await fileItem.waitFor({ state: 'visible', timeout: 2000 });
    
    // Open file actions menu with short timeout
    const actionsButton = fileItem.getByRole('button', { name: /actions|more/i });
    await actionsButton.click({ timeout: 2000 });
    
    // Click download button in the menu with short timeout
    const downloadLink = this.fileActionsMenu.getByRole('menuitem', { name: /download/i });
    
    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await downloadLink.click({ timeout: 2000 });
    
    // Wait for download to start
    await downloadPromise;
  }

  /**
   * Open file preview modal
   * @param fileId - The ID of the file to preview
   */
  async previewFile(fileId: string): Promise<void> {
    const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
    await fileItem.waitFor({ state: 'visible', timeout: 2000 });
    
    // Click on the file thumbnail or name to open preview
    const previewTrigger = fileItem.locator('[data-preview-trigger]').first();
    await previewTrigger.click({ timeout: 2000 });
    
    // Wait for preview modal to appear
    await this.filePreviewModal.waitFor({ state: 'visible', timeout: 2000 });
  }

  /**
   * Create a new folder
   * @param folderName - Name of the folder to create
   */
  async createFolder(folderName: string): Promise<void> {
    await this.createFolderButton.click({ timeout: 2000 });
    await this.folderNameInput.waitFor({ state: 'visible', timeout: 2000 });
    await this.folderNameInput.fill(folderName, { timeout: 2000 });
    
    // Submit the form (press Enter or click OK button)
    const submitButton = this.page.getByRole('button', { name: /create|ok|confirm/i });
    await submitButton.click({ timeout: 2000 });
    
    // Wait for folder to appear in the list
    await this.page.waitForSelector(`[data-file-name="${folderName}"][data-is-folder="true"]`, { timeout: 2000 });
  }

  /**
   * Navigate to a specific folder using path
   * @param folderPath - Path to navigate to (e.g., 'Documents/Work/Projects')
   */
  async navigateToFolder(folderPath: string): Promise<void> {
    const pathSegments = folderPath.split('/').filter(segment => segment.length > 0);
    
    for (const segment of pathSegments) {
      // Find and click the folder in the current directory
      const folderItem = this.fileList.locator(
        `[data-file-name="${segment}"][data-is-folder="true"]`
      );
      await folderItem.waitFor({ state: 'visible', timeout: 2000 });
      await folderItem.dblclick({ timeout: 2000 });
      
      // Wait for navigation to complete
      await this.page.waitForLoadState('networkidle', { timeout: 2000 });
    }
  }

  /**
   * Rename a file or folder
   * @param fileId - ID of the file to rename
   * @param newName - New name for the file
   */
  async renameFile(fileId: string, newName: string): Promise<void> {
    const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
    await fileItem.waitFor({ state: 'visible', timeout: 2000 });
    
    // Open file actions menu with short timeout
    const actionsButton = fileItem.getByRole('button', { name: /actions|more/i });
    await actionsButton.click({ timeout: 2000 });
    
    // Click rename option with short timeout
    const renameMenuItem = this.fileActionsMenu.getByRole('menuitem', { name: /rename/i });
    await renameMenuItem.click({ timeout: 2000 });
    
    // Wait for rename input and enter new name
    await this.renameInput.waitFor({ state: 'visible', timeout: 2000 });
    await this.renameInput.clear();
    await this.renameInput.fill(newName, { timeout: 2000 });
    
    // Submit rename
    const confirmButton = this.page.getByRole('button', { name: /save|confirm|ok/i });
    await confirmButton.click({ timeout: 2000 });
    
    // Wait for the file list to update
    await this.page.waitForSelector(`[data-file-name="${newName}"]`, { timeout: 2000 });
  }

  /**
   * Delete a file or folder
   * @param fileId - ID of the file to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
    await fileItem.waitFor({ state: 'visible', timeout: 2000 });
    
    // Open file actions menu with short timeout
    const actionsButton = fileItem.getByRole('button', { name: /actions|more/i });
    await actionsButton.click({ timeout: 2000 });
    
    // Click delete option with short timeout
    const deleteMenuItem = this.fileActionsMenu.getByRole('menuitem', { name: /delete/i });
    await deleteMenuItem.click({ timeout: 2000 });
    
    // Wait for confirmation modal and confirm
    await this.confirmDeleteModal.waitFor({ state: 'visible', timeout: 2000 });
    const confirmDeleteButton = this.confirmDeleteModal.getByRole('button', { name: /delete|confirm/i });
    await confirmDeleteButton.click({ timeout: 2000 });
    
    // Wait for file to be removed from list
    await this.page.waitForSelector(`[data-file-id="${fileId}"]`, { state: 'detached', timeout: 2000 });
  }

  /**
   * Move a file to a different folder
   * @param fileId - ID of the file to move
   * @param targetFolderId - ID of the destination folder
   */
  async moveFile(fileId: string, targetFolderId: string): Promise<void> {
    const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
    await fileItem.waitFor({ state: 'visible', timeout: 2000 });
    
    // Open file actions menu with short timeout
    const actionsButton = fileItem.getByRole('button', { name: /actions|more/i });
    await actionsButton.click({ timeout: 2000 });
    
    // Click move option with short timeout
    const moveMenuItem = this.fileActionsMenu.getByRole('menuitem', { name: /move/i });
    await moveMenuItem.click({ timeout: 2000 });
    
    // Wait for move destination selector
    await this.moveDestinationSelector.waitFor({ state: 'visible', timeout: 2000 });
    
    // Select target folder
    const targetFolder = this.moveDestinationSelector.locator(`[data-folder-id="${targetFolderId}"]`);
    await targetFolder.click({ timeout: 2000 });
    
    // Confirm move
    const confirmMoveButton = this.page.getByRole('button', { name: /move|confirm/i });
    await confirmMoveButton.click({ timeout: 2000 });
    
    // Wait for file to be removed from current view
    await this.page.waitForSelector(`[data-file-id="${fileId}"]`, { state: 'detached', timeout: 2000 });
  }

  /**
   * Get file permissions
   * @param fileId - ID of the file
   * @returns File permissions object
   */
  async getFilePermissions(fileId: string): Promise<FilePermissions> {
    const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
    await fileItem.waitFor({ state: 'visible', timeout: 2000 });
    
    // Open file actions menu with short timeout (fail fast if not implemented)
    const actionsButton = fileItem.getByRole('button', { name: /actions|more/i });
    await actionsButton.click({ timeout: 2000 });
    
    // Click permissions option with short timeout
    const permissionsMenuItem = this.fileActionsMenu.getByRole('menuitem', { name: /permissions|sharing/i });
    await permissionsMenuItem.click({ timeout: 2000 });
    
    // Wait for permissions modal with short timeout
    await this.permissionsModal.waitFor({ state: 'visible', timeout: 2000 });
    
    // Extract permissions data
    const canRead = await this.permissionsModal.locator('[data-permission="read"]').isChecked();
    const canWrite = await this.permissionsModal.locator('[data-permission="write"]').isChecked();
    const canDelete = await this.permissionsModal.locator('[data-permission="delete"]').isChecked();
    const canShare = await this.permissionsModal.locator('[data-permission="share"]').isChecked();
    const owner = await this.permissionsModal.locator('[data-owner]').textContent() || '';
    
    // Get shared with users
    const sharedWithElements = await this.permissionsModal.locator('[data-shared-user]').all();
    const sharedWith = await Promise.all(
      sharedWithElements.map(el => el.textContent().then(text => text || ''))
    );
    
    // Close modal
    const closeButton = this.permissionsModal.getByRole('button', { name: /close|cancel/i });
    await closeButton.click({ timeout: 2000 });
    
    return {
      canRead,
      canWrite,
      canDelete,
      canShare,
      owner,
      sharedWith: sharedWith.length > 0 ? sharedWith : undefined
    };
  }

  /**
   * Set file permissions
   * @param fileId - ID of the file
   * @param permissions - Permissions to set
   */
  async setFilePermissions(fileId: string, permissions: Partial<FilePermissions>): Promise<void> {
    const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
    await fileItem.waitFor({ state: 'visible', timeout: 2000 });
    
    // Open file actions menu with short timeout
    const actionsButton = fileItem.getByRole('button', { name: /actions|more/i });
    await actionsButton.click({ timeout: 2000 });
    
    // Click permissions option with short timeout
    const permissionsMenuItem = this.fileActionsMenu.getByRole('menuitem', { name: /permissions|sharing/i });
    await permissionsMenuItem.click({ timeout: 2000 });
    
    // Wait for permissions modal
    await this.permissionsModal.waitFor({ state: 'visible', timeout: 2000 });
    
    // Set permissions checkboxes if provided
    if (permissions.canRead !== undefined) {
      await this.permissionsModal.locator('[data-permission="read"]').setChecked(permissions.canRead, { timeout: 2000 });
    }
    if (permissions.canWrite !== undefined) {
      await this.permissionsModal.locator('[data-permission="write"]').setChecked(permissions.canWrite, { timeout: 2000 });
    }
    if (permissions.canDelete !== undefined) {
      await this.permissionsModal.locator('[data-permission="delete"]').setChecked(permissions.canDelete, { timeout: 2000 });
    }
    if (permissions.canShare !== undefined) {
      await this.permissionsModal.locator('[data-permission="share"]').setChecked(permissions.canShare, { timeout: 2000 });
    }
    
    // Save permissions
    const saveButton = this.permissionsModal.getByRole('button', { name: /save|apply|ok/i });
    await saveButton.click({ timeout: 2000 });
    
    // Wait for modal to close
    await this.permissionsModal.waitFor({ state: 'hidden', timeout: 2000 });
  }

  /**
   * Verify upload progress indicator is visible
   * @returns True if progress is visible
   */
  async verifyUploadProgress(): Promise<boolean> {
    try {
      await this.uploadProgress.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for upload to complete
   * @param timeout - Maximum wait time in milliseconds
   */
  async waitForUploadComplete(timeout: number = 30000): Promise<void> {
    // Wait for progress indicator to appear
    await this.uploadProgress.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // Progress might be too fast to catch
    });
    
    // Wait for progress indicator to disappear (upload complete)
    await this.uploadProgress.waitFor({ state: 'hidden', timeout });
    
    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify that a file exists in the repository
   * @param fileName - Name of the file to check
   * @returns True if file exists
   */
  async verifyFileExists(fileName: string): Promise<boolean> {
    try {
      const fileElement = this.fileList.locator(`[data-file-name="${fileName}"]`);
      await fileElement.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed information about a file
   * @param fileId - ID of the file
   * @returns File information object
   */
  async getFileInfo(fileId: string): Promise<FileInfo> {
    const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
    await fileItem.waitFor({ state: 'visible', timeout: 2000 });
    
    const id = fileId;
    const name = await fileItem.getAttribute('data-file-name') || '';
    const size = parseInt(await fileItem.getAttribute('data-file-size') || '0', 10);
    const type = await fileItem.getAttribute('data-file-type') || '';
    const modifiedDateStr = await fileItem.getAttribute('data-modified-date') || '';
    const createdDateStr = await fileItem.getAttribute('data-created-date') || '';
    const path = await fileItem.getAttribute('data-file-path') || '';
    const isFolder = (await fileItem.getAttribute('data-is-folder')) === 'true';
    const thumbnailUrl = await fileItem.getAttribute('data-thumbnail-url') || undefined;
    
    // Get permissions if available
    let permissions: FilePermissions | undefined;
    try {
      permissions = await this.getFilePermissions(fileId);
    } catch {
      // Permissions might not be accessible
      permissions = undefined;
    }
    
    return {
      id,
      name,
      size,
      type,
      modifiedDate: new Date(modifiedDateStr),
      createdDate: new Date(createdDateStr),
      path,
      isFolder,
      thumbnailUrl,
      permissions
    };
  }

  /**
   * Sort files by specified criteria
   * @param sortBy - Sort criteria (name, date, size, type)
   */
  async sortFiles(sortBy: SortOption): Promise<void> {
    await this.sortDropdown.waitFor({ state: 'visible', timeout: 2000 });
    await this.sortDropdown.click({ timeout: 2000 });
    
    // Select sort option from dropdown
    const sortOption = this.page.getByRole('option', { name: new RegExp(sortBy, 'i') });
    await sortOption.click({ timeout: 2000 });
    
    // Wait for list to re-render
    await this.page.waitForLoadState('networkidle', { timeout: 2000 });
  }

  /**
   * Search for files by name
   * @param query - Search query string
   */
  async searchFiles(query: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible', timeout: 2000 });
    await this.searchInput.clear();
    await this.searchInput.fill(query, { timeout: 2000 });
    
    // Wait for search to execute (either on Enter or auto-search)
    await this.searchInput.press('Enter');
    
    // Wait for search results to load
    await this.page.waitForLoadState('networkidle', { timeout: 2000 });
  }

  /**
   * Get current folder path from breadcrumbs
   * @returns Current folder path
   */
  async getCurrentPath(): Promise<string> {
    await this.breadcrumbs.waitFor({ state: 'visible', timeout: 2000 });
    const breadcrumbItems = await this.breadcrumbs.locator('[data-breadcrumb-item]').all();
    
    const pathSegments = await Promise.all(
      breadcrumbItems.map(item => item.textContent().then(text => text?.trim() || ''))
    );
    
    return pathSegments.join('/');
  }

  /**
   * Check if repository is empty
   * @returns True if no files are present
   */
  async isEmpty(): Promise<boolean> {
    try {
      await this.emptyStateMessage.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cancel an ongoing upload
   */
  async cancelUpload(): Promise<void> {
    await this.uploadProgress.waitFor({ state: 'visible', timeout: 2000 });
    await this.uploadCancelButton.click({ timeout: 2000 });
    
    // Wait for progress to disappear
    await this.uploadProgress.waitFor({ state: 'hidden', timeout: 2000 });
  }

  /**
   * Get upload progress percentage
   * @returns Progress percentage (0-100)
   */
  async getUploadProgress(): Promise<number> {
    await this.uploadProgressBar.waitFor({ state: 'visible', timeout: 2000 });
    const ariaValueNow = await this.uploadProgressBar.getAttribute('aria-valuenow');
    return parseInt(ariaValueNow || '0', 10);
  }

  /**
   * Navigate up one level in folder hierarchy
   */
  async navigateUp(): Promise<void> {
    const upButton = this.folderNavigation.getByRole('button', { name: /up|parent|back/i });
    await upButton.click({ timeout: 2000 });
    await this.page.waitForLoadState('networkidle', { timeout: 2000 });
  }

  /**
   * Select multiple files for batch operations
   * @param fileIds - Array of file IDs to select
   */
  async selectMultipleFiles(fileIds: string[]): Promise<void> {
    for (const fileId of fileIds) {
      const fileItem = this.fileList.locator(`[data-file-id="${fileId}"]`);
      const checkbox = fileItem.locator('input[type="checkbox"]');
      await checkbox.check({ timeout: 2000 });
    }
  }

  /**
   * Delete multiple files at once
   * @param fileIds - Array of file IDs to delete
   */
  async deleteMultipleFiles(fileIds: string[]): Promise<void> {
    await this.selectMultipleFiles(fileIds);
    
    // Click bulk delete button with short timeout
    const bulkDeleteButton = this.page.getByRole('button', { name: /delete selected/i });
    await bulkDeleteButton.click({ timeout: 2000 });
    
    // Confirm deletion
    await this.confirmDeleteModal.waitFor({ state: 'visible', timeout: 2000 });
    const confirmButton = this.confirmDeleteModal.getByRole('button', { name: /delete|confirm/i });
    await confirmButton.click({ timeout: 2000 });
    
    // Wait for files to be removed
    for (const fileId of fileIds) {
      await this.page.waitForSelector(`[data-file-id="${fileId}"]`, { state: 'detached', timeout: 2000 });
    }
  }
}
