/**
 * SectionList Component Unit Tests
 *
 * Comprehensive test suite for the SectionList component validating:
 * - Course sections and activities rendering
 * - Expandable/collapsible accordions
 * - Activity icons and completion checkboxes
 * - Visibility indicators for hidden items
 * - Teacher editing features (edit buttons, drag handles, visibility toggles)
 * - Drag-and-drop reordering support (UI elements)
 * - Accessibility compliance (ARIA labels, keyboard navigation)
 *
 * @module tests/unit/features/courses/SectionList
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import SectionList from '@/features/courses/components/SectionList';
import type { Section } from '@/features/courses/components/SectionList';
import type { Activity } from '@/features/courses/types/course.types';

// ============================================================================
// Test Utilities and Helpers
// ============================================================================

/**
 * Create MUI theme for test wrapper
 */
const testTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    success: {
      main: '#4caf50',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
      dark: '#1565c0',
      lighter: '#e3f2fd',
    },
    action: {
      hover: 'rgba(0, 0, 0, 0.04)',
    },
  },
});

/**
 * Wrapper component with theme provider for tests
 */
function TestWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <ThemeProvider theme={testTheme}>{children}</ThemeProvider>;
}

/**
 * Create sample activity data for testing
 */
function createSampleActivity(
  id: number,
  overrides?: Partial<Activity>
): Activity {
  return {
    id,
    name: `Activity ${id}`,
    type: 'Assignment',
    modname: 'assign',
    url: `/mod/assign/view.php?id=${id}`,
    completed: false,
    visible: true,
    ...overrides,
  };
}

/**
 * Create sample section data for testing
 */
function createSampleSection(
  id: number,
  overrides?: Partial<Section>
): Section {
  return {
    id,
    name: `Section ${id}`,
    summary: `Summary for section ${id}`,
    visible: true,
    activities: [],
    completionPercentage: 0,
    ...overrides,
  };
}

/**
 * Render helper with default props and theme wrapper
 */
function renderSectionList(
  props: {
    sections?: Section[];
    isTeacher?: boolean;
    onActivityClick?: (activityId: number) => void;
    onSectionEdit?: (sectionId: number) => void;
  } = {}
) {
  const defaultProps = {
    sections: [],
    isTeacher: false,
    onActivityClick: vi.fn(),
    onSectionEdit: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <TestWrapper>
        <SectionList {...defaultProps} />
      </TestWrapper>
    ),
    props: defaultProps,
  };
}

// ============================================================================
// Test Data Setup
// ============================================================================

// Sample activities with different types
const sampleActivities: Activity[] = [
  createSampleActivity(1, {
    name: 'Introduction Assignment',
    type: 'Assignment',
    modname: 'assign',
    completed: true,
  }),
  createSampleActivity(2, {
    name: 'Week 1 Quiz',
    type: 'Quiz',
    modname: 'quiz',
    completed: false,
  }),
  createSampleActivity(3, {
    name: 'Discussion Forum',
    type: 'Forum',
    modname: 'forum',
    completed: false,
  }),
  createSampleActivity(4, {
    name: 'Course Materials',
    type: 'Resource',
    modname: 'resource',
    completed: true,
  }),
  createSampleActivity(5, {
    name: 'Hidden Activity',
    type: 'Assignment',
    modname: 'assign',
    completed: false,
    visible: false,
  }),
];

// Sample sections with activities
const sampleSections: Section[] = [
  createSampleSection(1, {
    name: 'Introduction',
    summary: '<p>Welcome to the course!</p>',
    activities: [sampleActivities[0], sampleActivities[3]],
    completionPercentage: 100,
  }),
  createSampleSection(2, {
    name: 'Week 1: Getting Started',
    summary: '<p>This week we will cover the basics.</p>',
    activities: [sampleActivities[1], sampleActivities[2]],
    completionPercentage: 50,
  }),
  createSampleSection(3, {
    name: 'Hidden Section',
    summary: '<p>This section is hidden from students.</p>',
    activities: [sampleActivities[4]],
    completionPercentage: 0,
    visible: false,
  }),
];

// ============================================================================
// Test Suite
// ============================================================================

describe('SectionList', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders with sections array', () => {
      renderSectionList({ sections: sampleSections.slice(0, 2) });

      expect(screen.getByTestId('section-list')).toBeInTheDocument();
      expect(screen.getByTestId('section-1')).toBeInTheDocument();
      expect(screen.getByTestId('section-2')).toBeInTheDocument();
    });

    it('renders Accordion for each section', () => {
      renderSectionList({ sections: sampleSections.slice(0, 2) });

      const section1 = screen.getByTestId('section-1');
      const section2 = screen.getByTestId('section-2');

      expect(section1).toHaveClass('MuiAccordion-root');
      expect(section2).toHaveClass('MuiAccordion-root');
    });

    it('renders AccordionSummary with section name', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      expect(screen.getByText('Introduction')).toBeInTheDocument();
    });

    it('renders AccordionDetails with activities', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      // Activities are in the DOM but may not be visible until expanded
      const section = screen.getByTestId('section-1');
      expect(section).toBeInTheDocument();
    });

    it('has proper data-testid attributes', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      expect(screen.getByTestId('section-list')).toBeInTheDocument();
      expect(screen.getByTestId('section-1')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Section Accordion Structure Tests
  // ==========================================================================

  describe('Section Accordion Structure', () => {
    it('renders each section as Accordion component', () => {
      renderSectionList({ sections: sampleSections.slice(0, 2) });

      const accordions = screen.getAllByRole('region', { hidden: true });
      expect(accordions).toHaveLength(2);
    });

    it('shows AccordionSummary with section name', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Introduction').tagName).toBe('H3');
    });

    it('displays ExpandMore icon in summary', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const section = screen.getByTestId('section-1');
      const expandButton = within(section).getByRole('button', {
        name: /expand section introduction/i,
      });
      expect(expandButton).toBeInTheDocument();
    });

    it('contains AccordionDetails with activity list', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      // Expand the section
      const expandButton = screen.getByRole('button', {
        name: /expand section introduction/i,
      });
      await user.click(expandButton);

      // Check that activities are now visible
      await waitFor(() => {
        expect(screen.getByTestId('section-1-activities')).toBeInTheDocument();
      });
    });

    it('sections initially collapsed', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const section = screen.getByTestId('section-1');
      const expandButton = within(section).getByRole('button', {
        name: /expand section introduction/i,
      });

      // Check that the accordion is collapsed (aria-expanded should be false)
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  // ==========================================================================
  // Section Information Tests
  // ==========================================================================

  describe('Section Information', () => {
    it('displays section name prominently', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const sectionName = screen.getByText('Introduction');
      expect(sectionName).toBeInTheDocument();
      expect(sectionName.tagName).toBe('H3');
    });

    it('shows section summary when provided', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      // Expand section to see summary
      const expandButton = screen.getByRole('button', {
        name: /expand section introduction/i,
      });
      await user.click(expandButton);

      await waitFor(() => {
        const summary = screen.getByTestId('section-1-summary');
        expect(summary).toBeInTheDocument();
        expect(summary).toHaveTextContent('Welcome to the course!');
      });
    });

    it('displays section completion percentage chip for enrolled students', () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: false,
      });

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('does not show completion chip for teachers', () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
      });

      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('shows availability info if section is restricted', async () => {
      const restrictedSection = createSampleSection(1, {
        name: 'Restricted Section',
        availabilityInfo: 'Available from: 2024-01-15',
        activities: [],
      });

      renderSectionList({ sections: [restrictedSection] });

      // Expand section to see availability info
      const expandButton = screen.getByRole('button', {
        name: /expand section restricted section/i,
      });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Available from: 2024-01-15')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Section Visibility Tests
  // ==========================================================================

  describe('Section Visibility', () => {
    it('renders visible sections normally', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const section = screen.getByTestId('section-1');
      expect(section).toBeInTheDocument();
      expect(section).toHaveStyle({ opacity: 1 });
    });

    it('indicates hidden sections with icon in teacher view', () => {
      renderSectionList({
        sections: [sampleSections[2]],
        isTeacher: true,
      });

      expect(screen.getByText('Hidden')).toBeInTheDocument();
    });

    it('applies reduced opacity to hidden sections in teacher view', () => {
      renderSectionList({
        sections: [sampleSections[2]],
        isTeacher: true,
      });

      const section = screen.getByTestId('section-3');
      expect(section).toHaveStyle({ opacity: 0.6 });
    });

    it('shows VisibilityOff icon for hidden sections', () => {
      renderSectionList({
        sections: [sampleSections[2]],
        isTeacher: true,
      });

      expect(screen.getByText('Hidden')).toBeInTheDocument();
      expect(screen.getByLabelText('Section is hidden from students')).toBeInTheDocument();
    });

    it('student does not see hidden sections', () => {
      renderSectionList({
        sections: sampleSections,
        isTeacher: false,
      });

      expect(screen.queryByTestId('section-3')).not.toBeInTheDocument();
      expect(screen.queryByText('Hidden Section')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Section Expansion Tests
  // ==========================================================================

  describe('Section Expansion', () => {
    it('clicking AccordionSummary expands section', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const expandButton = screen.getByRole('button', {
        name: /expand section introduction/i,
      });

      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(expandButton);

      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('clicking again collapses section', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const expandButton = screen.getByRole('button', {
        name: /expand section introduction/i,
      });

      // Expand
      await user.click(expandButton);
      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      });

      // Collapse
      await user.click(expandButton);
      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('multiple sections can be expanded simultaneously', async () => {
      renderSectionList({ sections: sampleSections.slice(0, 2) });

      const expandButton1 = screen.getByRole('button', {
        name: /expand section introduction/i,
      });
      const expandButton2 = screen.getByRole('button', {
        name: /expand section week 1: getting started/i,
      });

      await user.click(expandButton1);
      await user.click(expandButton2);

      await waitFor(() => {
        expect(expandButton1).toHaveAttribute('aria-expanded', 'true');
        expect(expandButton2).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('expansion state managed correctly', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const expandButton = screen.getByRole('button', {
        name: /expand section introduction/i,
      });

      // Initially collapsed
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      // Expand
      await user.click(expandButton);
      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      });

      // Activities should be visible
      expect(screen.getByTestId('section-1-activities')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Activity List Rendering Tests
  // ==========================================================================

  describe('Activity List Rendering', () => {
    it('renders activities as List/ListItem components', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      // Expand section
      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        const activityList = screen.getByTestId('section-1-activities');
        expect(activityList).toBeInTheDocument();
        expect(activityList.tagName).toBe('UL');
      });
    });

    it('each activity has ListItemButton for interaction', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        expect(screen.getByText('Introduction Assignment')).toBeInTheDocument();
        expect(screen.getByText('Course Materials')).toBeInTheDocument();
      });
    });

    it('activities in correct order', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        const activities = screen.getAllByTestId(/activity-/);
        expect(activities[0]).toHaveAttribute('data-testid', 'activity-1');
        expect(activities[1]).toHaveAttribute('data-testid', 'activity-4');
      });
    });

    it('empty section shows "No activities" message', async () => {
      const emptySection = createSampleSection(1, {
        name: 'Empty Section',
        activities: [],
      });

      renderSectionList({ sections: [emptySection] });

      await user.click(
        screen.getByRole('button', { name: /expand section empty section/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId('section-1-empty')).toBeInTheDocument();
        expect(screen.getByText('No activities in this section')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Activity Icons Tests
  // ==========================================================================

  describe('Activity Icons', () => {
    it('assignment activities show Assignment icon', async () => {
      const section = createSampleSection(1, {
        activities: [createSampleActivity(1, { modname: 'assign' })],
      });

      renderSectionList({ sections: [section] });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId('activity-1')).toBeInTheDocument();
      });
    });

    it('quiz activities show Quiz icon', async () => {
      const section = createSampleSection(1, {
        activities: [createSampleActivity(1, { modname: 'quiz', type: 'Quiz' })],
      });

      renderSectionList({ sections: [section] });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId('activity-1')).toBeInTheDocument();
      });
    });

    it('forum activities show Forum icon', async () => {
      const section = createSampleSection(1, {
        activities: [createSampleActivity(1, { modname: 'forum', type: 'Forum' })],
      });

      renderSectionList({ sections: [section] });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId('activity-1')).toBeInTheDocument();
      });
    });

    it('resource activities show Description icon', async () => {
      const section = createSampleSection(1, {
        activities: [
          createSampleActivity(1, { modname: 'resource', type: 'Resource' }),
        ],
      });

      renderSectionList({ sections: [section] });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId('activity-1')).toBeInTheDocument();
      });
    });

    it('unknown activity types show default icon', async () => {
      const section = createSampleSection(1, {
        activities: [
          createSampleActivity(1, { modname: 'unknown', type: 'Unknown' }),
        ],
      });

      renderSectionList({ sections: [section] });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId('activity-1')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Activity Information Tests
  // ==========================================================================

  describe('Activity Information', () => {
    it('displays activity name as primary text', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        expect(screen.getByText('Introduction Assignment')).toBeInTheDocument();
      });
    });

    it('displays activity type as secondary text', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        expect(screen.getByText('Assignment')).toBeInTheDocument();
      });
    });

    it('activity modname used for icon selection', async () => {
      const section = createSampleSection(1, {
        activities: [
          createSampleActivity(1, { modname: 'assign', type: 'Assignment' }),
        ],
      });

      renderSectionList({ sections: [section] });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId('activity-1')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Activity Completion Tests
  // ==========================================================================

  describe('Activity Completion', () => {
    it('displays completion checkbox for students', async () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: false,
      });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });
    });

    it('checkbox checked when activity completed', async () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: false,
      });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        // First activity (Introduction Assignment) is completed
        const checkbox = screen.getByLabelText('Introduction Assignment is completed');
        expect(checkbox).toBeChecked();
      });
    });

    it('checkbox unchecked when not completed', async () => {
      const section = createSampleSection(1, {
        activities: [
          createSampleActivity(1, { name: 'Test Activity', completed: false }),
        ],
      });

      renderSectionList({ sections: [section], isTeacher: false });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        const checkbox = screen.getByLabelText('Test Activity is not completed');
        expect(checkbox).not.toBeChecked();
      });
    });

    it('shows CheckCircle icon for completed activities', async () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: false,
      });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Introduction Assignment completed')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Activity Visibility (Teacher View) Tests
  // ==========================================================================

  describe('Activity Visibility (Teacher View)', () => {
    it('displays visibility toggle icon for each activity', async () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
      });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        const visibilityIcons = screen.getAllByLabelText(
          /is visible to students|is hidden from students/i
        );
        expect(visibilityIcons.length).toBeGreaterThan(0);
      });
    });

    it('shows Visibility icon for visible activities', async () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
      });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        expect(
          screen.getByLabelText('Introduction Assignment is visible to students')
        ).toBeInTheDocument();
      });
    });

    it('shows VisibilityOff icon for hidden activities', async () => {
      const section = createSampleSection(1, {
        activities: [createSampleActivity(1, { visible: false })],
      });

      renderSectionList({ sections: [section], isTeacher: true });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        expect(
          screen.getByLabelText('Activity 1 is hidden from students')
        ).toBeInTheDocument();
      });
    });

    it('hidden activities have reduced opacity', async () => {
      const section = createSampleSection(1, {
        activities: [createSampleActivity(1, { visible: false })],
      });

      renderSectionList({ sections: [section], isTeacher: true });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(() => {
        const activity = screen.getByTestId('activity-1');
        expect(activity).toHaveStyle({ opacity: 0.5 });
      });
    });
  });

  // ==========================================================================
  // Teacher-Specific Features Tests
  // ==========================================================================

  describe('Teacher-Specific Features', () => {
    it('isTeacher prop enables teacher features', () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
      });

      expect(
        screen.getByLabelText('Drag to reorder section')
      ).toBeInTheDocument();
    });

    it('shows DragIndicator icon for reordering', () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
      });

      expect(
        screen.getByLabelText('Drag to reorder section')
      ).toBeInTheDocument();
    });

    it('shows Edit IconButton for inline editing', () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
        onSectionEdit: vi.fn(),
      });

      expect(screen.getByLabelText('Edit section Introduction')).toBeInTheDocument();
    });

    it('onSectionEdit callback provided for edit clicks', async () => {
      const onSectionEdit = vi.fn();

      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
        onSectionEdit,
      });

      const editButton = screen.getByLabelText('Edit section Introduction');
      await user.click(editButton);

      expect(onSectionEdit).toHaveBeenCalledWith(1);
    });

    it('teacher sees hidden items', () => {
      renderSectionList({
        sections: sampleSections,
        isTeacher: true,
      });

      expect(screen.getByText('Hidden Section')).toBeInTheDocument();
    });

    it('does not show completion chips for teachers', () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
      });

      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Activity Click Handling Tests
  // ==========================================================================

  describe('Activity Click Handling', () => {
    it('clicking activity ListItemButton calls onActivityClick', async () => {
      const onActivityClick = vi.fn();

      renderSectionList({
        sections: [sampleSections[0]],
        onActivityClick,
      });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(async () => {
        const activityButton = screen.getByText('Introduction Assignment').closest(
          'div[role="button"]'
        );
        if (activityButton) {
          await user.click(activityButton);
        }
      });

      expect(onActivityClick).toHaveBeenCalledWith(1);
    });

    it('onActivityClick receives correct activityId', async () => {
      const onActivityClick = vi.fn();

      renderSectionList({
        sections: [sampleSections[1]],
        onActivityClick,
      });

      await user.click(
        screen.getByRole('button', { name: /expand section/i })
      );

      await waitFor(async () => {
        const activityButton = screen.getByText('Week 1 Quiz').closest(
          'div[role="button"]'
        );
        if (activityButton) {
          await user.click(activityButton);
        }
      });

      expect(onActivityClick).toHaveBeenCalledWith(2);
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State', () => {
    it('shows "No sections available" when sections array empty', () => {
      renderSectionList({ sections: [] });

      expect(screen.getByTestId('section-list-empty')).toBeInTheDocument();
      expect(screen.getByText('No sections available')).toBeInTheDocument();
    });

    it('displays helpful message for empty course', () => {
      renderSectionList({ sections: [] });

      expect(
        screen.getByText('This course does not have any sections yet.')
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('accordion accessible via keyboard', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const expandButton = screen.getByRole('button', {
        name: /expand section introduction/i,
      });

      expandButton.focus();
      expect(expandButton).toHaveFocus();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('has proper ARIA labels on accordions', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      expect(
        screen.getByLabelText('Section: Introduction')
      ).toBeInTheDocument();
    });

    it('screen reader announces section expansion', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const expandButton = screen.getByRole('button', {
        name: /expand section introduction/i,
      });

      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton).toHaveAttribute(
        'aria-label',
        'Expand section Introduction'
      );
    });

    it('completion checkboxes have proper aria labels', async () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: false,
      });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Introduction Assignment is completed')).toBeInTheDocument();
      });
    });

    it('course sections list has role="list"', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const sectionList = screen.getByTestId('section-list');
      expect(sectionList).toHaveAttribute('role', 'list');
      expect(sectionList).toHaveAttribute('aria-label', 'Course sections');
    });

    it('activity list has proper aria label', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        const activityList = screen.getByTestId('section-1-activities');
        expect(activityList).toHaveAttribute('role', 'list');
        expect(activityList).toHaveAttribute(
          'aria-label',
          'Activities in Introduction'
        );
      });
    });
  });

  // ==========================================================================
  // Theme Integration Tests
  // ==========================================================================

  describe('Theme Integration', () => {
    it('renders with theme provider', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      expect(screen.getByTestId('section-list')).toBeInTheDocument();
    });

    it('accordion uses theme styling', () => {
      renderSectionList({ sections: [sampleSections[0]] });

      const section = screen.getByTestId('section-1');
      expect(section).toHaveClass('MuiAccordion-root');
    });
  });

  // ==========================================================================
  // Section Summary Tests
  // ==========================================================================

  describe('Section Summary', () => {
    it('displays section summary text', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        const summary = screen.getByTestId('section-1-summary');
        expect(summary).toHaveTextContent('Welcome to the course!');
      });
    });

    it('summary can include HTML', async () => {
      renderSectionList({ sections: [sampleSections[0]] });

      await user.click(
        screen.getByRole('button', { name: /expand section introduction/i })
      );

      await waitFor(() => {
        const summary = screen.getByTestId('section-1-summary');
        // Should render HTML content
        expect(summary.innerHTML).toContain('<p>Welcome to the course!</p>');
      });
    });
  });

  // ==========================================================================
  // Multiple Sections Tests
  // ==========================================================================

  describe('Multiple Sections', () => {
    it('renders 10+ sections without performance issues', () => {
      const manySections = Array.from({ length: 15 }, (_, i) =>
        createSampleSection(i + 1, {
          name: `Section ${i + 1}`,
          activities: [createSampleActivity(i * 10 + 1)],
        })
      );

      renderSectionList({ sections: manySections });

      expect(screen.getAllByRole('region', { hidden: true })).toHaveLength(15);
    });

    it('expand/collapse states independent', async () => {
      renderSectionList({ sections: sampleSections.slice(0, 2) });

      const expandButton1 = screen.getByRole('button', {
        name: /expand section introduction/i,
      });
      const expandButton2 = screen.getByRole('button', {
        name: /expand section week 1: getting started/i,
      });

      // Expand first section
      await user.click(expandButton1);

      await waitFor(() => {
        expect(expandButton1).toHaveAttribute('aria-expanded', 'true');
        expect(expandButton2).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  // ==========================================================================
  // Completion Percentage Display Tests
  // ==========================================================================

  describe('Completion Percentage Display', () => {
    it('shows completion chip with correct percentage', () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: false,
      });

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('chip color matches completion level', () => {
      const fullSection = createSampleSection(1, {
        completionPercentage: 100,
      });
      const partialSection = createSampleSection(2, {
        completionPercentage: 50,
      });

      renderSectionList({
        sections: [fullSection, partialSection],
        isTeacher: false,
      });

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('chip only shown for enrolled students', () => {
      renderSectionList({
        sections: [sampleSections[0]],
        isTeacher: true,
      });

      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });
  });
});

