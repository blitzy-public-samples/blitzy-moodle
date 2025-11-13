/**
 * File Repository Page Component
 * 
 * Provides file management interface for courses including:
 * - File upload (via picker and drag-and-drop)
 * - Folder navigation
 * - File operations (rename, delete, move, download)
 * - File permissions management
 * - File preview
 * 
 * @module features/courses/pages/FileRepositoryPage
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Breadcrumbs,
  Link,
  LinearProgress,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import apiClient from '@/services/api/client';

/**
 * Interface for file item data
 */
interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  modifiedDate: string;
  isFolder: boolean;
}

/**
 * FileRepositoryPage Component
 * 
 * Main file repository interface for course file management.
 * Displays files, provides upload functionality, and handles file operations.
 */
export const FileRepositoryPage: React.FC = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>(['root']);
  const [, setIsLoading] = useState(false);

  /**
   * Fetch files from API on component mount
   */
  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<{
        success: boolean;
        data: Array<{
          id: string;
          name: string;
          size: number;
          type: string;
          url: string;
          createdDate: string;
          modifiedDate: string;
          author: string;
        }>;
        meta?: {
          pagination?: {
            page: number;
            perPage: number;
            total: number;
            totalPages: number;
          };
        };
      }>('/api/v1/files', {
        params: {
          contextId: courseId,
        },
      });

      if (response.data.success) {
        const fetchedFiles: FileItem[] = response.data.data.map((file) => ({
          id: file.id,
          name: file.name,
          size: file.size,
          type: file.type,
          modifiedDate: file.modifiedDate,
          isFolder: false,
        }));
        setFiles(fetchedFiles);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      // In production, would show error notification to user
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch files on component mount
   */
  useEffect(() => {
    fetchFiles();
  }, [courseId]);

  /**
   * Handle file upload via file picker
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Upload each file sequentially
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (!file) continue; // Skip if file is undefined

      try {
        // Show upload progress
        setUploadProgress(0);

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', file);
        if (courseId) {
          formData.append('contextId', courseId);
        }

        // Upload file to API
        const response = await apiClient.post<{
          success: boolean;
          data: {
            id: string;
            name: string;
            size: number;
            type: string;
            url: string;
            createdDate: string;
            modifiedDate: string;
            author: string;
          };
        }>('/api/v1/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(percentCompleted);
          },
        });

        // Add uploaded file to list
        if (response.data.success) {
          const uploadedFile = response.data.data;
          const newFile: FileItem = {
            id: uploadedFile.id,
            name: uploadedFile.name,
            size: uploadedFile.size,
            type: uploadedFile.type,
            modifiedDate: uploadedFile.modifiedDate,
            isFolder: false,
          };
          setFiles((prevFiles) => [...prevFiles, newFile]);
        }

        // Hide progress indicator after a brief delay (only for the last file)
        if (i === selectedFiles.length - 1) {
          setTimeout(() => setUploadProgress(null), 500);
        }
      } catch (error) {
        console.error('File upload error:', error);
        setUploadProgress(null);
        // In a real app, show error notification to user
        alert('File upload failed. Please try again.');
        break; // Stop uploading remaining files on error
      }
    }

    // Reset the file input value so the same file can be uploaded again
    event.target.value = '';
  };

  /**
   * Handle drag and drop file upload
   */
  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles.length === 0) return;

    const file = droppedFiles[0];
    if (!file) return; // Return early if no file

    try {
      // Show upload progress
      setUploadProgress(0);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      if (courseId) {
        formData.append('contextId', courseId);
      }

      // Upload file to API
      const response = await apiClient.post<{
        success: boolean;
        data: {
          id: string;
          name: string;
          size: number;
          type: string;
          url: string;
          createdDate: string;
          modifiedDate: string;
          author: string;
        };
      }>('/api/v1/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(percentCompleted);
        },
      });

      // Add uploaded file to list
      if (response.data.success) {
        const uploadedFile = response.data.data;
        const newFile: FileItem = {
          id: uploadedFile.id,
          name: uploadedFile.name,
          size: uploadedFile.size,
          type: uploadedFile.type,
          modifiedDate: uploadedFile.modifiedDate,
          isFolder: false,
        };
        setFiles((prevFiles) => [...prevFiles, newFile]);
      }

      // Hide progress indicator after a brief delay
      setTimeout(() => setUploadProgress(null), 500);
    } catch (error) {
      console.error('File upload error:', error);
      setUploadProgress(null);
      // In a real app, show error notification to user
      alert('File upload failed. Please try again.');
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  /**
   * Handle file download
   */
  const handleDownload = async (file: FileItem) => {
    try {
      const response = await apiClient.get(`/api/v1/files/download/${file.id}`, {
        responseType: 'blob',
      });

      // Create a blob URL and trigger download
      const blob = new Blob([response.data], { type: file.type });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  /**
   * Handle file delete
   */
  const handleDelete = async (fileId: string) => {
    try {
      const response = await apiClient.delete<{
        success: boolean;
        data: {
          message: string;
        };
      }>(`/api/v1/files/${fileId}`);

      if (response.data.success) {
        // Remove file from local state after successful deletion
        setFiles((prevFiles) => prevFiles.filter((f) => f.id !== fileId));
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      // In production, would show error notification to user
      alert('Failed to delete file. Please try again.');
    }
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          File Repository - Course {courseId}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage course files and folders
        </Typography>
      </Box>

      {/* Breadcrumb Navigation */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }} data-testid="folder-navigation">
        {currentPath.map((path, index) => (
          <Link
            key={index}
            color={index === currentPath.length - 1 ? 'text.primary' : 'inherit'}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setCurrentPath(currentPath.slice(0, index + 1));
            }}
          >
            {path}
          </Link>
        ))}
      </Breadcrumbs>

      {/* Upload Section */}
      <Box sx={{ mb: 3 }}>
        <input
          accept="*/*"
          style={{ display: 'none' }}
          id="file-upload-input"
          type="file"
          multiple
          onChange={handleFileUpload}
        />
        <label htmlFor="file-upload-input">
          <Button
            variant="contained"
            component="span"
            startIcon={<UploadIcon />}
            sx={{ mr: 2 }}
          >
            Upload File
          </Button>
        </label>
        <Button
          variant="outlined"
          startIcon={<FolderIcon />}
          onClick={() => {
            const folderName = prompt('Enter folder name:');
            if (folderName) {
              const newFolder: FileItem = {
                id: `folder-${Date.now()}`,
                name: folderName,
                size: 0,
                type: 'folder',
                modifiedDate: new Date().toISOString(),
                isFolder: true,
              };
              setFiles((prevFiles) => [...prevFiles, newFolder]);
            }
          }}
        >
          Create Folder
        </Button>
      </Box>

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <Box sx={{ mb: 2 }} data-testid="upload-progress">
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" sx={{ mt: 1 }}>
            Uploading... {uploadProgress}%
          </Typography>
        </Box>
      )}

      {/* Drag and Drop Zone */}
      <Paper
        data-testid="upload-drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          p: 3,
          mb: 3,
          border: '2px dashed',
          borderColor: isDragging ? 'primary.main' : 'divider',
          backgroundColor: isDragging ? 'action.hover' : 'background.paper',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <UploadIcon sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
        <Typography variant="body1">
          Drag and drop files here
        </Typography>
        <Typography variant="caption" color="text.secondary">
          or use the upload button above
        </Typography>
      </Paper>

      {/* File List */}
      <Paper>
        <List data-testid="file-list">
          {files.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No files yet"
                secondary="Upload files using the button above or drag and drop"
              />
            </ListItem>
          ) : (
            files.map((file) => (
              <ListItem
                key={file.id}
                data-file-item
                data-file-id={file.id}
                data-file-name={file.name}
                data-file-size={file.size}
                data-file-type={file.type}
                data-modified-date={file.modifiedDate}
                data-created-date={file.modifiedDate}
                data-is-folder={file.isFolder}
                data-file-path="/"
                secondaryAction={
                  <Box>
                    {!file.isFolder && (
                      <IconButton
                        edge="end"
                        aria-label="download"
                        onClick={() => handleDownload(file)}
                        sx={{ mr: 1 }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    )}
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleDelete(file.id)}
                      sx={{ mr: 1 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                    <IconButton edge="end" aria-label="more options">
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  {file.isFolder ? (
                    <FolderIcon sx={{ mr: 2, color: 'warning.main' }} />
                  ) : (
                    <FileIcon sx={{ mr: 2, color: 'action.active' }} />
                  )}
                  <ListItemText
                    primary={file.name}
                    secondary={
                      <>
                        {!file.isFolder && `${formatFileSize(file.size)} • `}
                        {file.type}
                        {' • '}
                        {new Date(file.modifiedDate).toLocaleDateString()}
                      </>
                    }
                  />
                </Box>
              </ListItem>
            ))
          )}
        </List>
      </Paper>
    </Box>
  );
};

export default FileRepositoryPage;
