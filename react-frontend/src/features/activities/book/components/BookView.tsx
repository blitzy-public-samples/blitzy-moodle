/**
 * BookView Component
 *
 * Main container React component for the book activity module that orchestrates
 * the complete book reading experience. This component integrates:
 * - ChapterList: Table of contents sidebar with hierarchical chapter navigation
 * - ChapterContent: Main content area displaying chapter HTML with proper formatting
 * - BookNavigation: Previous/Next navigation controls with keyboard shortcuts
 *
 * Features:
 * - Responsive two-column layout (TOC sidebar + content area)
 * - Permission-based feature toggling (edit, view hidden chapters)
 * - Loading and error state handling
 * - Completion tracking integration with Moodle
 * - Chapter navigation state management
 * - Auto-redirect to edit page for empty books (when user has edit permission)
 *
 * Reference: Based on PHP implementation in public/mod/book/view.php
 * Transformation: PHP session-based editing mode → React state management
 *
 * @module features/activities/book/components/BookView
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Skeleton,
  useTheme,
  useMediaQuery,
  Drawer,
  IconButton,
  Fab,
} from '@mui/material';
import { Menu as MenuIcon, Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material';

// Internal component imports
import { BookNavigation } from './BookNavigation';
import { ChapterList } from './ChapterList';
import { ChapterContent } from './ChapterContent';

// Hook imports
import { useBook } from '../hooks/useBook';
import { useBookChapters } from '../hooks/useBookChapters';
import { usePermissions } from '@/hooks/usePermissions';

// API imports
import { recordBookView } from '../api/bookApi';

// Type imports
import type { Chapter } from '../types/book.types';

// Feedback component imports
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';

/**
 * Props interface for the BookView component
 * Follows Moodle book module URL parameter conventions
 */
export interface BookViewProps {
  /**
   * Unique identifier of the book instance
   * Corresponds to book.id in Moodle database
   */
  bookId: number;

  /**
   * Course module ID for context and navigation
   * Corresponds to cm.id in Moodle database
   */
  courseModuleId: number;

  /**
   * Optional initial chapter ID to display
   * If not provided, displays the first available chapter
   * Corresponds to 'chapterid' URL parameter in view.php
   */
  initialChapterId?: number;

  /**
   * Optional course ID for breadcrumb navigation context
   */
  courseId?: number;
}

/**
 * Width constants for responsive layout
 * Based on common Material-UI breakpoint patterns
 */
const TOC_DRAWER_WIDTH = 280;
const TOC_SIDEBAR_COLUMNS = { xs: 12, md: 3, lg: 3 };
const CONTENT_COLUMNS = { xs: 12, md: 9, lg: 9 };

/**
 * BookView Component
 *
 * Main container component that orchestrates the book reading experience.
 * Implements responsive layout with TOC sidebar and content area,
 * manages chapter navigation state, and handles permission-based features.
 *
 * @param props - BookView component props
 * @returns JSX.Element - The complete book view interface
 */
export default function BookView({
  bookId,
  courseModuleId,
  initialChapterId,
  courseId,
}: BookViewProps): JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State for current chapter selection
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(
    initialChapterId ?? null
  );

  // State for mobile drawer (TOC sidebar)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // State for edit mode toggle
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // State for tracking if view has been recorded
  const [viewRecorded, setViewRecorded] = useState<boolean>(false);

  // Fetch book data using React Query hook
  const {
    data: book,
    isLoading: isBookLoading,
    error: bookError,
    isError: isBookError,
  } = useBook(bookId);

  // Fetch chapters data using React Query hook
  const {
    chapters,
    mainChapters,
    getNavigationChapters,
    isFirstChapter,
    isLastChapter,
    isLoading: isChaptersLoading,
    error: chaptersError,
    isError: isChaptersError,
  } = useBookChapters(bookId);

  // Get permission checking hook
  const { hasCapability } = usePermissions();

  /**
   * Check user capabilities for book module
   * These map directly to Moodle capabilities:
   * - mod/book:edit - Can edit book content
   * - mod/book:viewhiddenchapters - Can see hidden chapters
   */
  const canEdit = useMemo(
    () => hasCapability('mod/book:edit', courseModuleId),
    [hasCapability, courseModuleId]
  );

  const canViewHidden = useMemo(
    () => hasCapability('mod/book:viewhiddenchapters', courseModuleId),
    [hasCapability, courseModuleId]
  );

  /**
   * Filter chapters based on user permissions
   * Hidden chapters only visible to users with viewhiddenchapters capability
   */
  const visibleChapters = useMemo(() => {
    if (!chapters) return [];
    return canViewHidden
      ? chapters
      : chapters.filter((chapter) => !chapter.hidden);
  }, [chapters, canViewHidden]);

  /**
   * Get the current chapter object based on currentChapterId
   * Falls back to first visible chapter if current chapter is invalid
   */
  const currentChapter = useMemo(() => {
    if (!visibleChapters.length) return null;

    // If currentChapterId is set, find that chapter
    if (currentChapterId !== null) {
      const chapter = visibleChapters.find((c) => c.id === currentChapterId);
      if (chapter) return chapter;
    }

    // Fall back to first visible chapter
    return visibleChapters[0] || null;
  }, [visibleChapters, currentChapterId]);

  /**
   * Get navigation chapters (previous and next) for BookNavigation component
   */
  const navigationChapters = useMemo(() => {
    if (!currentChapter || !getNavigationChapters) {
      return { previous: null, next: null };
    }
    return getNavigationChapters(currentChapter.id);
  }, [currentChapter, getNavigationChapters]);

  /**
   * Effect: Initialize currentChapterId with first chapter if not set
   * Mirrors view.php behavior: "If chapterid is not given, we try to find first."
   */
  useEffect(() => {
    if (currentChapterId === null && visibleChapters.length > 0) {
      const firstChapter = visibleChapters[0];
      setCurrentChapterId(firstChapter.id);
    }
  }, [currentChapterId, visibleChapters]);

  /**
   * Effect: Record book/chapter view for analytics and completion tracking
   * Mirrors book_view() and chapter_viewed event in view.php
   * Only records once per session to avoid duplicate tracking
   */
  useEffect(() => {
    const recordView = async () => {
      if (viewRecorded || !currentChapter) return;

      try {
        await recordBookView(bookId, currentChapter.id);
        setViewRecorded(true);
      } catch (error) {
        // Silently fail - view recording is not critical for user experience
        console.error('Failed to record book view:', error);
      }
    };

    recordView();
  }, [bookId, currentChapter, viewRecorded]);

  /**
   * Effect: Reset view recorded flag when chapter changes
   * This enables tracking individual chapter views
   */
  useEffect(() => {
    setViewRecorded(false);
  }, [currentChapterId]);

  /**
   * Effect: Redirect to edit page when book has no chapters and user can edit
   * Mirrors view.php lines 94-97: redirect to editchapter.php for empty books
   */
  useEffect(() => {
    if (!isChaptersLoading && visibleChapters.length === 0 && canEdit) {
      // Redirect to chapter creation page
      navigate(`/mod/book/${courseModuleId}/chapter/new`);
    }
  }, [isChaptersLoading, visibleChapters.length, canEdit, courseModuleId, navigate]);

  /**
   * Handle chapter selection from TOC or navigation
   * Updates state and closes mobile drawer if open
   */
  const handleChapterSelect = useCallback((chapterId: number) => {
    setCurrentChapterId(chapterId);
    // Close mobile drawer when chapter is selected
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  }, [isMobile]);

  /**
   * Handle navigation button clicks (prev/next)
   */
  const handleNavigate = useCallback((chapterId: number) => {
    setCurrentChapterId(chapterId);
    // Scroll to top of content area
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /**
   * Toggle mobile TOC drawer
   */
  const toggleMobileDrawer = useCallback(() => {
    setMobileDrawerOpen((prev) => !prev);
  }, []);

  /**
   * Handle edit button click - navigate to edit page
   */
  const handleEditClick = useCallback(() => {
    if (currentChapter) {
      navigate(`/mod/book/${courseModuleId}/chapter/${currentChapter.id}/edit`);
    }
  }, [currentChapter, courseModuleId, navigate]);

  // Loading state - show spinner while data is being fetched
  if (isBookLoading || isChaptersLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          width: '100%',
        }}
      >
        <LoadingSpinner size="large" message="Loading book..." />
      </Box>
    );
  }

  // Error state - show alert for book loading errors
  if (isBookError) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert
          severity="error"
          title="Failed to Load Book"
          message={
            bookError instanceof Error
              ? bookError.message
              : 'An unexpected error occurred while loading the book. Please try again later.'
          }
        />
      </Box>
    );
  }

  // Error state - show alert for chapters loading errors
  if (isChaptersError) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert
          severity="error"
          title="Failed to Load Chapters"
          message={
            chaptersError instanceof Error
              ? chaptersError.message
              : 'An unexpected error occurred while loading the book chapters. Please try again later.'
          }
        />
      </Box>
    );
  }

  // Book not found state
  if (!book) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert
          severity="warning"
          title="Book Not Found"
          message="The requested book could not be found. It may have been deleted or you may not have permission to access it."
        />
      </Box>
    );
  }

  // Empty book state (for users without edit permission)
  if (visibleChapters.length === 0 && !canEdit) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert
          severity="info"
          title="No Content Available"
          message="This book does not have any chapters yet. Please check back later."
        />
      </Box>
    );
  }

  // Chapter not found state
  if (!currentChapter && visibleChapters.length > 0) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert
          severity="warning"
          title="Chapter Not Found"
          message="The requested chapter could not be found. It may have been deleted or hidden."
        />
      </Box>
    );
  }

  /**
   * Render the Table of Contents sidebar content
   * Used in both desktop sidebar and mobile drawer
   */
  const renderTocContent = () => (
    <ChapterList
      chapters={visibleChapters}
      currentChapterId={currentChapter?.id ?? null}
      book={{ numbering: book.numbering, customtitles: book.customtitles }}
      onChapterClick={handleChapterSelect}
      canViewHidden={canViewHidden}
      isEditing={isEditing}
    />
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        py: 2,
      }}
      className="book-view-container"
    >
      {/* Book Title Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {book.name}
          {/* Mobile menu button */}
          {isMobile && (
            <IconButton
              onClick={toggleMobileDrawer}
              aria-label="Open table of contents"
              sx={{ ml: 'auto' }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Typography>
        {book.intro && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1 }}
            dangerouslySetInnerHTML={{ __html: book.intro }}
          />
        )}
      </Box>

      {/* Main Content Area with Grid Layout */}
      <Grid container spacing={3}>
        {/* Desktop TOC Sidebar */}
        {!isMobile && (
          <Grid item {...TOC_SIDEBAR_COLUMNS}>
            <Paper
              elevation={1}
              sx={{
                position: 'sticky',
                top: theme.spacing(2),
                maxHeight: `calc(100vh - ${theme.spacing(4)})`,
                overflow: 'auto',
                p: 2,
                borderRadius: 2,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  mb: 1,
                  pb: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Table of Contents
              </Typography>
              {renderTocContent()}
            </Paper>
          </Grid>
        )}

        {/* Content Area */}
        <Grid item {...CONTENT_COLUMNS}>
          <Paper
            elevation={1}
            sx={{
              p: { xs: 2, sm: 3, md: 4 },
              borderRadius: 2,
              minHeight: 400,
            }}
          >
            {/* Chapter Content */}
            {currentChapter && (
              <ChapterContent
                chapter={currentChapter}
                customTitles={book.customtitles}
                chapters={visibleChapters}
              />
            )}

            {/* Navigation Controls */}
            {currentChapter && (
              <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                <BookNavigation
                  currentChapterId={currentChapter.id}
                  chapters={visibleChapters}
                  onNavigate={handleNavigate}
                />
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Mobile TOC Drawer */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={toggleMobileDrawer}
        PaperProps={{
          sx: {
            width: TOC_DRAWER_WIDTH,
            maxWidth: '85vw',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              Table of Contents
            </Typography>
            <IconButton
              onClick={toggleMobileDrawer}
              size="small"
              aria-label="Close table of contents"
            >
              <CloseIcon />
            </IconButton>
          </Box>
          {renderTocContent()}
        </Box>
      </Drawer>

      {/* Floating Edit Button (for users with edit permission) */}
      {canEdit && currentChapter && (
        <Fab
          color="primary"
          aria-label="Edit chapter"
          onClick={handleEditClick}
          sx={{
            position: 'fixed',
            bottom: theme.spacing(3),
            right: theme.spacing(3),
            zIndex: theme.zIndex.fab,
          }}
        >
          <EditIcon />
        </Fab>
      )}
    </Box>
  );
}
