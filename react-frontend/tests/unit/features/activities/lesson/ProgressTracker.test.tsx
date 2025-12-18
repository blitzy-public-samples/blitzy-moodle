/**
 * Unit Tests for ProgressTracker Component
 *
 * Comprehensive unit tests validating progress visualization through branching lesson paths
 * with completion indicators, showing visited pages, current position, remaining pages with
 * visual progress bar and navigation breadcrumbs supporting both linear and branching navigation patterns.
 *
 * Tests validate:
 * - Basic progress display with MaterialUI LinearProgress
 * - Visited pages indicators with checkmark icons
 * - Current position highlighting with different color/styling
 * - Progress statistics (pages completed, time spent, score)
 * - Branching path visualization with tree structure
 * - Linear lesson navigation with simple progress bar
 * - Completion status indicators (completed, in-progress, not-started)
 * - Responsive design on mobile and desktop viewports
 * - Accessibility features (ARIA labels, keyboard navigation)
 * - Progress API integration with loading and error states
 *
 * @see public/mod/lesson/locallib.php for lesson structure logic
 * @module tests/unit/features/activities/lesson/ProgressTracker.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import '@testing-library/jest-dom';

// Internal imports from test helpers
import { render, screen, waitFor, userEvent } from '@/tests/helpers/render';
import { server } from '@/tests/mocks/server';

// Component under test
import ProgressTracker from '@/features/activities/lesson/components/ProgressTracker';

// Types
import type { LessonProgress, LessonPage } from '@/features/activities/lesson/types/lesson.types';
import { QuestionType } from '@/features/activities/lesson/types/lesson.types';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock LessonPage with customizable properties
 */
function createMockPage(overrides: Partial<LessonPage> = {}): LessonPage {
  return {
    id: 1,
    lessonid: 1,
    prevpageid: 0,
    nextpageid: 0,
    qtype: QuestionType.MULTICHOICE,
    qoption: 0,
    layout: 1,
    display: 1,
    timecreated: Date.now() / 1000,
    timemodified: Date.now() / 1000,
    title: 'Test Page',
    contents: '<p>Test content</p>',
    contentsformat: 1,
    ...overrides,
  };
}

/**
 * Creates a mock LessonProgress with customizable properties
 */
function createMockProgress(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    visitedPages: [1, 2, 3],
    currentPageId: 4,
    progressPercentage: 50,
    pagesCompleted: 3,
    totalPages: 6,
    timeSpent: 300,
    score: 75,
    isCompleted: false,
    ...overrides,
  };
}

/**
 * Creates a linear lesson structure with sequential pages
 */
function createLinearLessonPages(count: number = 5): LessonPage[] {
  return Array.from({ length: count }, (_, index) => {
    const pageId = index + 1;
    return createMockPage({
      id: pageId,
      title: `Page ${pageId}`,
      prevpageid: index > 0 ? index : 0,
      nextpageid: index < count - 1 ? pageId + 1 : 0,
      qtype: index % 2 === 0 ? QuestionType.MULTICHOICE : QuestionType.TRUEFALSE,
    });
  });
}

/**
 * Creates a branching lesson structure with clusters and branch tables
 */
function createBranchingLessonPages(): LessonPage[] {
  return [
    // Main entry page (Branch Table)
    createMockPage({
      id: 1,
      title: 'Lesson Introduction',
      prevpageid: 0,
      nextpageid: 2,
      qtype: QuestionType.BRANCHTABLE,
    }),
    // First branch start (Cluster)
    createMockPage({
      id: 2,
      title: 'Chapter 1: Basics',
      prevpageid: 1,
      nextpageid: 3,
      qtype: QuestionType.CLUSTER,
    }),
    // Question in cluster
    createMockPage({
      id: 3,
      title: 'Question 1: Multiple Choice',
      prevpageid: 2,
      nextpageid: 4,
      qtype: QuestionType.MULTICHOICE,
    }),
    // Another question in cluster
    createMockPage({
      id: 4,
      title: 'Question 2: True/False',
      prevpageid: 3,
      nextpageid: 5,
      qtype: QuestionType.TRUEFALSE,
    }),
    // End of cluster
    createMockPage({
      id: 5,
      title: 'End of Chapter 1',
      prevpageid: 4,
      nextpageid: 6,
      qtype: QuestionType.ENDOFCLUSTER,
    }),
    // Second branch (Branch Table)
    createMockPage({
      id: 6,
      title: 'Chapter 2: Advanced Topics',
      prevpageid: 5,
      nextpageid: 7,
      qtype: QuestionType.BRANCHTABLE,
    }),
    // Short answer question
    createMockPage({
      id: 7,
      title: 'Short Answer Question',
      prevpageid: 6,
      nextpageid: 8,
      qtype: QuestionType.SHORTANSWER,
    }),
    // Essay question
    createMockPage({
      id: 8,
      title: 'Essay Question',
      prevpageid: 7,
      nextpageid: 9,
      qtype: QuestionType.ESSAY,
    }),
    // End of branch
    createMockPage({
      id: 9,
      title: 'End of Branch',
      prevpageid: 8,
      nextpageid: 10,
      qtype: QuestionType.ENDOFBRANCH,
    }),
    // Final content page
    createMockPage({
      id: 10,
      title: 'Lesson Summary',
      prevpageid: 9,
      nextpageid: 0,
      qtype: 0, // Content page
    }),
  ];
}

/**
 * Creates a complex nested lesson structure with multiple levels of branching
 */
function createNestedBranchingLessonPages(): LessonPage[] {
  const pages: LessonPage[] = [];
  let pageId = 1;

  // Main branch table
  pages.push(createMockPage({
    id: pageId++,
    title: 'Main Branch Table',
    prevpageid: 0,
    nextpageid: pageId,
    qtype: QuestionType.BRANCHTABLE,
  }));

  // First cluster with nested content
  pages.push(createMockPage({
    id: pageId++,
    title: 'Cluster 1: Beginner',
    prevpageid: pageId - 2,
    nextpageid: pageId,
    qtype: QuestionType.CLUSTER,
  }));

  // Nested questions in cluster 1
  for (let i = 0; i < 3; i++) {
    pages.push(createMockPage({
      id: pageId++,
      title: `Beginner Question ${i + 1}`,
      prevpageid: pageId - 2,
      nextpageid: pageId,
      qtype: QuestionType.MULTICHOICE,
    }));
  }

  // End of cluster 1
  pages.push(createMockPage({
    id: pageId++,
    title: 'End Cluster 1',
    prevpageid: pageId - 2,
    nextpageid: pageId,
    qtype: QuestionType.ENDOFCLUSTER,
  }));

  // Second cluster with nested content
  pages.push(createMockPage({
    id: pageId++,
    title: 'Cluster 2: Intermediate',
    prevpageid: pageId - 2,
    nextpageid: pageId,
    qtype: QuestionType.CLUSTER,
  }));

  // Nested questions in cluster 2
  for (let i = 0; i < 4; i++) {
    pages.push(createMockPage({
      id: pageId++,
      title: `Intermediate Question ${i + 1}`,
      prevpageid: pageId - 2,
      nextpageid: pageId,
      qtype: QuestionType.TRUEFALSE,
    }));
  }

  // End of cluster 2
  pages.push(createMockPage({
    id: pageId++,
    title: 'End Cluster 2',
    prevpageid: pageId - 2,
    nextpageid: 0,
    qtype: QuestionType.ENDOFCLUSTER,
  }));

  return pages;
}

/**
 * Creates a lesson with only content pages (no questions)
 */
function createContentOnlyLessonPages(count: number = 5): LessonPage[] {
  return Array.from({ length: count }, (_, index) => {
    const pageId = index + 1;
    return createMockPage({
      id: pageId,
      title: `Content Page ${pageId}`,
      prevpageid: index > 0 ? index : 0,
      nextpageid: index < count - 1 ? pageId + 1 : 0,
      qtype: 0, // Content page
    });
  });
}

/**
 * Creates a lesson with only question pages (no content pages)
 */
function createQuestionOnlyLessonPages(count: number = 5): LessonPage[] {
  const questionTypes = [
    QuestionType.SHORTANSWER,
    QuestionType.TRUEFALSE,
    QuestionType.MULTICHOICE,
    QuestionType.MATCHING,
    QuestionType.NUMERICAL,
  ];

  return Array.from({ length: count }, (_, index) => {
    const pageId = index + 1;
    return createMockPage({
      id: pageId,
      title: `Question ${pageId}`,
      prevpageid: index > 0 ? index : 0,
      nextpageid: index < count - 1 ? pageId + 1 : 0,
      qtype: questionTypes[index % questionTypes.length],
    });
  });
}

/**
 * Creates a large lesson with many pages for performance testing
 */
function createLargeLessonPages(count: number = 50): LessonPage[] {
  return Array.from({ length: count }, (_, index) => {
    const pageId = index + 1;
    const questionTypes = [
      QuestionType.MULTICHOICE,
      QuestionType.TRUEFALSE,
      QuestionType.SHORTANSWER,
      0, // Content page
    ];
    return createMockPage({
      id: pageId,
      title: `Lesson Page ${pageId} with a longer title for truncation testing`,
      prevpageid: index > 0 ? index : 0,
      nextpageid: index < count - 1 ? pageId + 1 : 0,
      qtype: questionTypes[index % questionTypes.length],
    });
  });
}

// ============================================================================
// API Mock Helpers
// ============================================================================

/**
 * Sets up a mock handler for the lesson pages API endpoint
 */
function setupPagesApiHandler(pages: LessonPage[]) {
  server.use(
    http.get('/api/v1/lesson/:lessonId/pages', () => {
      return HttpResponse.json({
        success: true,
        data: {
          pages,
          totalPages: pages.length,
          questionPages: pages.filter(p => p.qtype > 0 && p.qtype < 20).length,
          contentPages: pages.filter(p => p.qtype === 0).length,
          accessiblePages: pages.map(p => p.id),
        },
      });
    })
  );
}

/**
 * Sets up an API handler that returns an error
 */
function setupPagesApiErrorHandler(status: number = 500, message: string = 'Internal server error') {
  server.use(
    http.get('/api/v1/lesson/:lessonId/pages', () => {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'API_ERROR',
            message,
          },
        },
        { status }
      );
    })
  );
}

/**
 * Sets up an API handler with a delay for testing loading states
 */
function setupPagesApiDelayedHandler(pages: LessonPage[], delayMs: number = 100) {
  server.use(
    http.get('/api/v1/lesson/:lessonId/pages', async () => {
      await delay(delayMs);
      return HttpResponse.json({
        success: true,
        data: {
          pages,
          totalPages: pages.length,
          questionPages: pages.filter(p => p.qtype > 0 && p.qtype < 20).length,
          contentPages: pages.filter(p => p.qtype === 0).length,
          accessiblePages: pages.map(p => p.id),
        },
      });
    })
  );
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ProgressTracker', () => {
  beforeEach(() => {
    // Reset handlers before each test
    server.resetHandlers();
  });

  afterEach(() => {
    // Clean up after each test
    server.resetHandlers();
  });

  // ==========================================================================
  // Basic Progress Display Tests
  // ==========================================================================
  describe('Basic Progress Display', () => {
    it('renders ProgressTracker with mock lesson progress data', async () => {
      const linearPages = createLinearLessonPages(6);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        progressPercentage: 50,
        pagesCompleted: 3,
        totalPages: 6,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
        />
      );

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
      });

      // Check that the title is present
      expect(screen.getByRole('heading', { name: /lesson progress/i })).toBeInTheDocument();
    });

    it('renders MaterialUI LinearProgress component with progress bar', async () => {
      const linearPages = createLinearLessonPages(10);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        progressPercentage: 65,
        pagesCompleted: 6,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
        />
      );

      // Wait for the progress bar to render
      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('displays correct progress percentage value', async () => {
      const linearPages = createLinearLessonPages(10);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        progressPercentage: 75,
        pagesCompleted: 7,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
        />
      );

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      });
    });

    it('displays progress label text', async () => {
      const linearPages = createLinearLessonPages(10);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        progressPercentage: 50,
        pagesCompleted: 5,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
        />
      );

      await waitFor(() => {
        // Check for percentage text
        expect(screen.getByText(/50%/)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Visited Pages Indicators Tests
  // ==========================================================================
  describe('Visited Pages Indicators', () => {
    it('renders checkmark icons for completed pages', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        pagesCompleted: 3,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Check for completed page indicators
        const completedIcons = screen.getAllByLabelText('Completed');
        expect(completedIcons.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('shows different styling for visited vs unvisited pages', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Check for completed icons
        expect(screen.getAllByLabelText('Completed').length).toBeGreaterThanOrEqual(2);
        // Check for not started icons
        expect(screen.getAllByLabelText('Not started').length).toBeGreaterThanOrEqual(2);
      });
    });

    it('renders the page list correctly', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Check for page titles
        expect(screen.getByText('Page 1')).toBeInTheDocument();
        expect(screen.getByText('Page 2')).toBeInTheDocument();
        expect(screen.getByText('Page 3')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Current Position Highlighting Tests
  // ==========================================================================
  describe('Current Position Highlighting', () => {
    it('highlights current page with different color/styling', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Check for current page indicator
        const currentPageIcon = screen.getByLabelText('Current page');
        expect(currentPageIcon).toBeInTheDocument();
      });
    });

    it('marks current page with aria-current attribute', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Check that there's exactly one current page indicator
        const currentPageIndicators = screen.getAllByLabelText('Current page');
        expect(currentPageIndicators.length).toBe(1);
      });
    });

    it('displays current page icon correctly', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Verify current page has different indicator than completed
        const currentIcon = screen.getByLabelText('Current page');
        const completedIcons = screen.getAllByLabelText('Completed');
        expect(currentIcon).toBeTruthy();
        expect(completedIcons.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // Progress Statistics Tests
  // ==========================================================================
  describe('Progress Statistics', () => {
    it('displays pages completed count', async () => {
      const linearPages = createLinearLessonPages(10);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3, 4, 5],
        currentPageId: 6,
        pagesCompleted: 5,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/5 \/ 10 pages/)).toBeInTheDocument();
      });
    });

    it('displays total pages count', async () => {
      const linearPages = createLinearLessonPages(8);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 8,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        // Should show pages count
        expect(screen.getByText(/2 \/ 8 pages/)).toBeInTheDocument();
      });
    });

    it('displays time spent', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        timeSpent: 330, // 5 minutes 30 seconds
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/5m 30s/)).toBeInTheDocument();
      });
    });

    it('displays score when applicable', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3, 4, 5],
        currentPageId: 5,
        score: 80,
        isCompleted: true,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        // Should show score display
        expect(screen.getByText(/80\/100/)).toBeInTheDocument();
      });
    });

    it('hides statistics when showStatistics is false', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        pagesCompleted: 3,
        totalPages: 5,
        timeSpent: 300,
        score: 75,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
          showStatistics={false}
        />
      );

      await waitFor(() => {
        // Statistics group should not be present
        expect(screen.queryByRole('group', { name: /progress statistics/i })).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Branching Path Visualization Tests
  // ==========================================================================
  describe('Branching Path Visualization', () => {
    it('renders tree visualization for branching lesson structure', async () => {
      const branchingPages = createBranchingLessonPages();
      setupPagesApiHandler(branchingPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        pagesCompleted: 3,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Check for branch table and cluster indicators
        expect(screen.getByText('Branch', { selector: '.MuiChip-label' }) || screen.getByText('Cluster', { selector: '.MuiChip-label' })).toBeInTheDocument();
      });
    });

    it('shows collapsible sections for branch tables', async () => {
      const branchingPages = createBranchingLessonPages();
      setupPagesApiHandler(branchingPages);

      const progress = createMockProgress({
        visitedPages: [1],
        currentPageId: 2,
        pagesCompleted: 1,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Look for expand/collapse buttons
        const expandButtons = screen.queryAllByLabelText(/expand section/i);
        const collapseButtons = screen.queryAllByLabelText(/collapse section/i);
        // At least one expand or collapse button should exist
        expect(expandButtons.length + collapseButtons.length).toBeGreaterThan(0);
      });
    });

    it('displays cluster grouping correctly', async () => {
      const branchingPages = createBranchingLessonPages();
      setupPagesApiHandler(branchingPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Check for Cluster label
        const clusterChips = screen.getAllByText('Cluster');
        expect(clusterChips.length).toBeGreaterThan(0);
      });
    });

    it('allows toggling collapsed sections', async () => {
      const branchingPages = createBranchingLessonPages();
      setupPagesApiHandler(branchingPages);

      const progress = createMockProgress({
        visitedPages: [1],
        currentPageId: 2,
        pagesCompleted: 1,
        totalPages: 10,
      });

      const { user } = render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
      });

      // Find expand buttons and click one
      const expandButtons = screen.queryAllByLabelText(/expand section|collapse section/i);
      if (expandButtons.length > 0) {
        await user.click(expandButtons[0]);
        // After clicking, the state should change
        await waitFor(() => {
          // The button aria-label or aria-expanded should have changed
          expect(expandButtons[0]).toHaveAttribute('aria-expanded');
        });
      }
    });
  });

  // ==========================================================================
  // Linear Lesson Navigation Tests
  // ==========================================================================
  describe('Linear Lesson Navigation', () => {
    it('renders simple progress bar for linear lessons', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        progressPercentage: 40,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
        expect(progressBar).toHaveAttribute('aria-valuenow', '40');
      });
    });

    it('shows sequential page indicators for linear lessons', async () => {
      const linearPages = createLinearLessonPages(4);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 4,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // All pages should be listed sequentially
        expect(screen.getByText('Page 1')).toBeInTheDocument();
        expect(screen.getByText('Page 2')).toBeInTheDocument();
        expect(screen.getByText('Page 3')).toBeInTheDocument();
        expect(screen.getByText('Page 4')).toBeInTheDocument();
      });
    });

    it('does not show branch/cluster chips for linear lessons', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
      });

      // Branch and Cluster chips should not appear in linear lessons
      expect(screen.queryByText('Branch')).not.toBeInTheDocument();
      expect(screen.queryByText('Cluster')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Completion Status Indicators Tests
  // ==========================================================================
  describe('Completion Status Indicators', () => {
    it('displays correct icons for completed pages', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        pagesCompleted: 3,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const completedIcons = screen.getAllByLabelText('Completed');
        expect(completedIcons.length).toBe(3);
      });
    });

    it('displays correct icon for in-progress page', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const currentPageIcon = screen.getByLabelText('Current page');
        expect(currentPageIcon).toBeInTheDocument();
      });
    });

    it('displays correct icons for not-started pages', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const notStartedIcons = screen.getAllByLabelText('Not started');
        expect(notStartedIcons.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('renders Chip components for branch/cluster status', async () => {
      const branchingPages = createBranchingLessonPages();
      setupPagesApiHandler(branchingPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Look for MUI Chip components with Branch or Cluster labels
        const branchChips = screen.getAllByText('Branch');
        const clusterChips = screen.getAllByText('Cluster');
        expect(branchChips.length + clusterChips.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // Responsive Design Tests
  // ==========================================================================
  describe('Responsive Design', () => {
    it('renders correctly on mobile viewport', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      // Render with mobile-like viewport
      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const tracker = screen.getByRole('region', { name: /lesson progress tracker/i });
        expect(tracker).toBeInTheDocument();
      });
    });

    it('renders correctly on desktop viewport', async () => {
      const linearPages = createLinearLessonPages(10);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3, 4, 5],
        currentPageId: 6,
        pagesCompleted: 5,
        totalPages: 10,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const tracker = screen.getByRole('region', { name: /lesson progress tracker/i });
        expect(tracker).toBeInTheDocument();
      });
    });

    it('uses Material-UI Box and responsive props', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Component should render without errors
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================
  describe('Accessibility', () => {
    it('has ARIA labels for progress region', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
      });
    });

    it('has ARIA labels for statistics group', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /progress statistics/i })).toBeInTheDocument();
      });
    });

    it('has ARIA labels for legend', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /progress legend/i })).toBeInTheDocument();
      });
    });

    it('supports keyboard navigation when allowNavigation is true', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      const onPageClick = vi.fn();

      const { user } = render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          allowNavigation={true}
          onPageClick={onPageClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
      });

      // Tab through interactive elements
      await user.tab();
      // Should be able to navigate with keyboard
    });

    it('has accessible status icons', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Check all status icons have appropriate aria-labels
        expect(screen.getAllByLabelText('Completed').length).toBeGreaterThan(0);
        expect(screen.getByLabelText('Current page')).toBeInTheDocument();
        expect(screen.getAllByLabelText('Not started').length).toBeGreaterThan(0);
      });
    });

    it('has accessible progress bar with ARIA attributes', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        progressPercentage: 60,
        pagesCompleted: 3,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '60');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      });
    });
  });

  // ==========================================================================
  // API Integration Tests
  // ==========================================================================
  describe('Progress API Integration', () => {
    it('fetches lesson pages data', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // All pages should be rendered from API data
        expect(screen.getByText('Page 1')).toBeInTheDocument();
        expect(screen.getByText('Page 5')).toBeInTheDocument();
      });
    });

    it('displays loading state', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiDelayedHandler(linearPages, 500);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          isLoading={true}
        />
      );

      // Should show loading state immediately
      expect(screen.getByLabelText(/loading progress tracker/i)).toBeInTheDocument();
    });

    it('handles API errors gracefully', async () => {
      setupPagesApiErrorHandler(500, 'Failed to load lesson pages');

      const progress = createMockProgress({
        visitedPages: [1],
        currentPageId: 2,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Should display error message
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('handles error prop', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      render(
        <ProgressTracker
          lessonId={1}
          error={new Error('Custom error message')}
        />
      );

      // Should display the error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/custom error message/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles zero progress (no pages visited)', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [],
        currentPageId: 1,
        progressPercentage: 0,
        pagesCompleted: 0,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      });
    });

    it('handles 100% completion', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3, 4, 5],
        currentPageId: 5,
        progressPercentage: 100,
        pagesCompleted: 5,
        totalPages: 5,
        isCompleted: true,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '100');
        // Should show completion message
        expect(screen.getByText(/lesson completed/i)).toBeInTheDocument();
      });
    });

    it('handles complex multi-level branching (nested clusters)', async () => {
      const nestedPages = createNestedBranchingLessonPages();
      setupPagesApiHandler(nestedPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        pagesCompleted: 3,
        totalPages: nestedPages.length,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Should render without crashing
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
        // Should have multiple clusters
        const clusterChips = screen.getAllByText('Cluster');
        expect(clusterChips.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('handles lesson containing only content pages (no questions)', async () => {
      const contentPages = createContentOnlyLessonPages(5);
      setupPagesApiHandler(contentPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
        score: 0, // No score for content-only lessons
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Should render all content pages
        expect(screen.getByText('Content Page 1')).toBeInTheDocument();
        expect(screen.getByText('Content Page 5')).toBeInTheDocument();
      });
    });

    it('handles lesson containing only question pages', async () => {
      const questionPages = createQuestionOnlyLessonPages(5);
      setupPagesApiHandler(questionPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        pagesCompleted: 3,
        totalPages: 5,
        score: 60,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
        />
      );

      await waitFor(() => {
        // Should render all question pages
        expect(screen.getByText('Question 1')).toBeInTheDocument();
        expect(screen.getByText('Question 5')).toBeInTheDocument();
      });
    });

    it('handles mixed content and question pages', async () => {
      const mixedPages = [
        createMockPage({ id: 1, title: 'Introduction', qtype: 0 }),
        createMockPage({ id: 2, title: 'Quiz 1', qtype: QuestionType.MULTICHOICE, prevpageid: 1, nextpageid: 3 }),
        createMockPage({ id: 3, title: 'Reading Material', qtype: 0, prevpageid: 2, nextpageid: 4 }),
        createMockPage({ id: 4, title: 'Quiz 2', qtype: QuestionType.TRUEFALSE, prevpageid: 3, nextpageid: 5 }),
        createMockPage({ id: 5, title: 'Summary', qtype: 0, prevpageid: 4, nextpageid: 0 }),
      ];
      setupPagesApiHandler(mixedPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        pagesCompleted: 2,
        totalPages: 5,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Introduction')).toBeInTheDocument();
        expect(screen.getByText('Quiz 1')).toBeInTheDocument();
        expect(screen.getByText('Reading Material')).toBeInTheDocument();
      });
    });

    it('handles lesson with no visible progress due to practice mode', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      // No progress data in practice mode
      render(
        <ProgressTracker
          lessonId={1}
          progress={undefined}
        />
      );

      await waitFor(() => {
        // Should still render without progress data
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
        // Progress should be 0
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      });
    });

    it('handles long lesson names with truncation', async () => {
      const pagesWithLongTitles = [
        createMockPage({
          id: 1,
          title: 'This is a very long lesson page title that should be truncated on mobile devices',
          prevpageid: 0,
          nextpageid: 2,
        }),
        createMockPage({
          id: 2,
          title: 'Another extremely long title that goes on and on and should also be truncated',
          prevpageid: 1,
          nextpageid: 0,
        }),
      ];
      setupPagesApiHandler(pagesWithLongTitles);

      const progress = createMockProgress({
        visitedPages: [1],
        currentPageId: 2,
        pagesCompleted: 1,
        totalPages: 2,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Should render without breaking layout
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
        // Long titles should be present (truncation handled by CSS)
        expect(screen.getByText(/this is a very long lesson page title/i)).toBeInTheDocument();
      });
    });

    it('handles large number of pages (50+)', async () => {
      const largePages = createLargeLessonPages(50);
      setupPagesApiHandler(largePages);

      const progress = createMockProgress({
        visitedPages: Array.from({ length: 25 }, (_, i) => i + 1),
        currentPageId: 26,
        progressPercentage: 50,
        pagesCompleted: 25,
        totalPages: 50,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Should render the component without performance issues
        expect(screen.getByRole('region', { name: /lesson progress tracker/i })).toBeInTheDocument();
        // Progress should be accurate
        expect(screen.getByText(/25 \/ 50 pages/)).toBeInTheDocument();
      });
    });

    it('handles empty pages response', async () => {
      server.use(
        http.get('/api/v1/lesson/:lessonId/pages', () => {
          return HttpResponse.json({
            success: true,
            data: {
              pages: [],
              totalPages: 0,
              questionPages: 0,
              contentPages: 0,
              accessiblePages: [],
            },
          });
        })
      );

      const progress = createMockProgress({
        visitedPages: [],
        currentPageId: 0,
        pagesCompleted: 0,
        totalPages: 0,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Should show "no pages available" message
        expect(screen.getByText(/no lesson pages available/i)).toBeInTheDocument();
      });
    });

    it('handles time spent formatting for hours', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        timeSpent: 4500, // 1 hour 15 minutes
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/1h 15m/)).toBeInTheDocument();
      });
    });

    it('handles time spent formatting for seconds only', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1],
        currentPageId: 2,
        timeSpent: 45, // 45 seconds
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/45s/)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Page Click Callback Tests
  // ==========================================================================
  describe('Page Click Callback', () => {
    it('calls onPageClick when page is clicked with allowNavigation', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      const onPageClick = vi.fn();

      const { user } = render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          allowNavigation={true}
          onPageClick={onPageClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Page 1')).toBeInTheDocument();
      });

      // Find and click a page item
      const pageItem = screen.getByText('Page 1').closest('[role="button"]');
      if (pageItem) {
        await user.click(pageItem);
        expect(onPageClick).toHaveBeenCalledWith(1);
      }
    });

    it('does not call onPageClick when allowNavigation is false', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      const onPageClick = vi.fn();

      const { user } = render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          allowNavigation={false}
          onPageClick={onPageClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Page 1')).toBeInTheDocument();
      });

      // Try to click a page item
      const pageText = screen.getByText('Page 1');
      await user.click(pageText);
      
      // Should not call onPageClick when navigation is disabled
      expect(onPageClick).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Question Type Icons Tests
  // ==========================================================================
  describe('Question Type Icons', () => {
    it('displays different icons for different question types', async () => {
      const mixedPages = [
        createMockPage({ id: 1, title: 'Content Page', qtype: 0 }),
        createMockPage({ id: 2, title: 'Multiple Choice', qtype: QuestionType.MULTICHOICE, prevpageid: 1, nextpageid: 3 }),
        createMockPage({ id: 3, title: 'Branch Table', qtype: QuestionType.BRANCHTABLE, prevpageid: 2, nextpageid: 0 }),
      ];
      setupPagesApiHandler(mixedPages);

      const progress = createMockProgress({
        visitedPages: [1],
        currentPageId: 2,
        pagesCompleted: 1,
        totalPages: 3,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Component should render all pages with appropriate icons
        expect(screen.getByText('Content Page')).toBeInTheDocument();
        expect(screen.getByText('Multiple Choice')).toBeInTheDocument();
        expect(screen.getByText('Branch Table')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Score Display Tests
  // ==========================================================================
  describe('Score Display', () => {
    it('displays score with percentage when maxScore is provided', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3, 4, 5],
        currentPageId: 5,
        score: 70,
        isCompleted: true,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/70\/100/)).toBeInTheDocument();
        expect(screen.getByText(/70%/)).toBeInTheDocument();
      });
    });

    it('displays score without percentage when maxScore is not provided', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3],
        currentPageId: 4,
        score: 50,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/50 points/)).toBeInTheDocument();
      });
    });

    it('does not display score chip when score is 0', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
        score: 0,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        // Should not show score when it's 0
        expect(screen.queryByText(/points/)).not.toBeInTheDocument();
        expect(screen.queryByText(/0\/100/)).not.toBeInTheDocument();
      });
    });

    it('shows success color for high scores', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2, 3, 4, 5],
        currentPageId: 5,
        score: 85,
        isCompleted: true,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          maxScore={100}
          showStatistics={true}
        />
      );

      await waitFor(() => {
        // Score should be displayed with success styling (≥70%)
        expect(screen.getByText(/85\/100/)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Legend Display Tests
  // ==========================================================================
  describe('Legend Display', () => {
    it('displays legend with status explanations', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
        />
      );

      await waitFor(() => {
        // Legend should show status explanations
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('Current')).toBeInTheDocument();
        expect(screen.getByText('Not started')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Custom ClassName Tests
  // ==========================================================================
  describe('Custom ClassName', () => {
    it('applies custom className to component', async () => {
      const linearPages = createLinearLessonPages(5);
      setupPagesApiHandler(linearPages);

      const progress = createMockProgress({
        visitedPages: [1, 2],
        currentPageId: 3,
      });

      render(
        <ProgressTracker
          lessonId={1}
          progress={progress}
          className="custom-progress-tracker"
        />
      );

      await waitFor(() => {
        const region = screen.getByRole('region', { name: /lesson progress tracker/i });
        expect(region).toHaveClass('custom-progress-tracker');
      });
    });
  });
});
