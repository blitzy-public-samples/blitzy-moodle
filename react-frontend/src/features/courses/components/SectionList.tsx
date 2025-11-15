/**
 * SectionList Component
 *
 * Renders course sections with activities in an expandable/collapsible list format.
 * Displays activity icons, completion status, and supports teacher-specific features
 * like drag-and-drop reordering and inline editing.
 *
 * @module features/courses/components/SectionList
 */

import type React from 'react';
import { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Checkbox,
  Typography,
  IconButton,
  Chip,
  Box,
} from '@mui/material';
import {
  ExpandMore,
  Assignment,
  Quiz,
  Forum,
  Visibility,
  VisibilityOff,
  Edit,
  DragIndicator,
  CheckCircle,
  Description,
  Book,
  VideoCameraFront,
  Link,
  Folder,
} from '@mui/icons-material';
import type { Activity } from '@/features/courses/types/course.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Section data structure for UI display
 */
export interface Section {
  /** Section ID */
  id: number;

  /** Section name/title */
  name: string;

  /** Section summary/description */
  summary: string;

  /** Section visibility */
  visible: boolean;

  /** Availability information for restricted sections */
  availabilityInfo?: string;

  /** Activities in this section */
  activities: Activity[];

  /** Completion percentage for this section (0-100) */
  completionPercentage: number;
}

/**
 * Props for the SectionList component
 */
export interface SectionListProps {
  /** Array of course sections to display */
  sections: Section[];

  /** Whether the current user is a teacher/editing user */
  isTeacher: boolean;

  /** Callback when an activity is clicked */
  onActivityClick: (activityId: number) => void;

  /** Optional callback when a section edit is requested (teacher only) */
  onSectionEdit?: (sectionId: number) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the appropriate icon component for an activity type
 *
 * Maps Moodle activity module names to Material-UI icons for visual representation.
 *
 * @param modname - The Moodle module name (e.g., 'assign', 'quiz', 'forum')
 * @returns React element representing the activity type icon
 */
function getActivityIcon(modname: string): React.ReactElement {
  switch (modname.toLowerCase()) {
    case 'assign':
    case 'assignment':
      return <Assignment />;

    case 'quiz':
      return <Quiz />;

    case 'forum':
      return <Forum />;

    case 'resource':
    case 'file':
      return <Description />;

    case 'book':
      return <Book />;

    case 'url':
    case 'link':
      return <Link />;

    case 'folder':
      return <Folder />;

    case 'page':
      return <Description />;

    case 'video':
    case 'videotimeplugin':
    case 'bigbluebuttonbn':
      return <VideoCameraFront />;

    case 'lesson':
      return <Book />;

    case 'workshop':
      return <Assignment />;

    case 'wiki':
      return <Description />;

    case 'glossary':
      return <Book />;

    case 'data':
    case 'database':
      return <Description />;

    case 'feedback':
    case 'survey':
      return <Assignment />;

    case 'choice':
    case 'poll':
      return <Quiz />;

    case 'scorm':
    case 'h5pactivity':
      return <Book />;

    case 'lti':
    case 'tool':
      return <Link />;

    default:
      // Default icon for unknown activity types
      return <Description />;
  }
}

/**
 * Format completion percentage for display
 *
 * @param percentage - Completion percentage (0-100)
 * @returns Formatted string with percentage symbol
 */
function formatCompletionPercentage(percentage: number): string {
  return `${Math.round(percentage)}%`;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * SectionList Component
 *
 * Displays course sections in an expandable accordion layout with activities.
 * Supports completion tracking, visibility controls, and teacher editing features.
 *
 * Features:
 * - Expandable/collapsible sections using Material-UI Accordion
 * - Activity icons based on module type
 * - Completion checkmarks for enrolled students
 * - Visibility indicators for hidden items
 * - Drag-and-drop handles for teachers (visual only, actual reordering handled by parent)
 * - Edit buttons for teachers
 * - Accessibility support with ARIA labels and keyboard navigation
 *
 * @param props - Component properties
 * @returns Rendered section list component
 */
export default function SectionList({
  sections,
  isTeacher,
  onActivityClick,
  onSectionEdit,
}: SectionListProps): React.ReactElement {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>(() => {
    // Initialize with all sections collapsed - user must click to expand
    const initialExpanded: Record<number, boolean> = {};
    return initialExpanded;
  });

  /**
   * Handle accordion expansion/collapse
   *
   * @param sectionId - ID of the section being toggled
   */
  const handleAccordionChange = (sectionId: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  /**
   * Handle activity click
   *
   * @param activityId - ID of the clicked activity
   * @param event - Mouse event
   */
  const handleActivityClick = (
    activityId: number,
    event: React.MouseEvent<HTMLDivElement>
  ): void => {
    event.stopPropagation();
    onActivityClick(activityId);
  };

  /**
   * Handle section edit button click
   *
   * @param sectionId - ID of the section to edit
   * @param event - Mouse event
   */
  const handleSectionEdit = (
    sectionId: number,
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    event.stopPropagation();
    if (onSectionEdit) {
      onSectionEdit(sectionId);
    }
  };

  // If no sections, show empty state
  if (sections.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          color: 'text.secondary',
        }}
        data-testid="section-list-empty"
      >
        <Typography variant="h6" gutterBottom>
          No sections available
        </Typography>
        <Typography variant="body2">
          This course does not have any sections yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ width: '100%' }}
      data-testid="section-list"
      role="list"
      aria-label="Course sections"
    >
      {sections
        .filter((section) => isTeacher || section.visible)
        .map((section) => {
        const isExpanded = expandedSections[section.id] ?? false;
        const sectionOpacity = !section.visible && isTeacher ? 0.6 : 1;

        return (
          <Accordion
            key={section.id}
            expanded={isExpanded}
            onChange={() => handleAccordionChange(section.id)}
            sx={{
              mb: 2,
              opacity: sectionOpacity,
              '&:before': {
                display: 'none', // Remove default divider
              },
            }}
            data-testid={`section-${section.id}`}
            aria-label={`Section: ${section.name}`}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center',
                  gap: 2,
                },
              }}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} section ${section.name}`}
            >
              {/* Drag handle for teachers */}
              {isTeacher && (
                <DragIndicator
                  sx={{
                    color: 'text.secondary',
                    cursor: 'grab',
                    '&:active': {
                      cursor: 'grabbing',
                    },
                  }}
                  aria-label="Drag to reorder section"
                />
              )}

              {/* Section name */}
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  flexGrow: 1,
                  fontWeight: 500,
                }}
              >
                {section.name || 'Untitled Section'}
              </Typography>

              {/* Completion chip for enrolled students */}
              {!isTeacher && section.completionPercentage >= 0 && (
                <Chip
                  label={formatCompletionPercentage(section.completionPercentage)}
                  size="small"
                  color={section.completionPercentage === 100 ? 'success' : 'default'}
                  icon={
                    section.completionPercentage === 100 ? <CheckCircle /> : undefined
                  }
                  sx={{ mr: 1 }}
                  aria-label={`Section completion: ${formatCompletionPercentage(
                    section.completionPercentage
                  )}`}
                />
              )}

              {/* Visibility indicator for hidden sections */}
              {!section.visible && isTeacher && (
                <Chip
                  icon={<VisibilityOff />}
                  label="Hidden"
                  size="small"
                  variant="outlined"
                  color="warning"
                  sx={{ mr: 1 }}
                  aria-label="Section is hidden from students"
                />
              )}

              {/* Edit button for teachers */}
              {isTeacher && onSectionEdit && (
                <IconButton
                  size="small"
                  onClick={(e) => handleSectionEdit(section.id, e)}
                  sx={{ mr: 1 }}
                  aria-label={`Edit section ${section.name}`}
                >
                  <Edit fontSize="small" />
                </IconButton>
              )}
            </AccordionSummary>

            <AccordionDetails>
              {/* Section summary */}
              {section.summary && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                  dangerouslySetInnerHTML={{ __html: section.summary }}
                  data-testid={`section-${section.id}-summary`}
                />
              )}

              {/* Availability information for restricted sections */}
              {section.availabilityInfo && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1.5,
                    backgroundColor: 'info.lighter',
                    borderRadius: 1,
                    borderLeft: 3,
                    borderColor: 'info.main',
                  }}
                  role="status"
                  aria-label="Section availability information"
                >
                  <Typography variant="body2" color="info.dark">
                    {section.availabilityInfo}
                  </Typography>
                </Box>
              )}

              {/* Activities list */}
              {section.activities.length > 0 ? (
                <List
                  sx={{ pt: 0 }}
                  data-testid={`section-${section.id}-activities`}
                  role="list"
                  aria-label={`Activities in ${section.name}`}
                >
                  {section.activities.map((activity) => {
                    const activityOpacity =
                      !activity.visible && isTeacher ? 0.5 : 1;

                    return (
                      <ListItem
                        key={activity.id}
                        disablePadding
                        sx={{
                          opacity: activityOpacity,
                        }}
                        data-testid={`activity-${activity.id}`}
                      >
                        <ListItemButton
                          onClick={(e) => handleActivityClick(activity.id, e)}
                          sx={{
                            borderRadius: 1,
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                          }}
                          aria-label={`${activity.name}, ${activity.type}${
                            activity.completed ? ', completed' : ''
                          }`}
                        >
                          {/* Activity type icon */}
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            {getActivityIcon(activity.modname)}
                          </ListItemIcon>

                          {/* Activity name and type */}
                          <ListItemText
                            primary={activity.name}
                            secondary={activity.type}
                            primaryTypographyProps={{
                              sx: {
                                fontWeight: activity.completed ? 400 : 500,
                              },
                            }}
                          />

                          {/* Completion checkbox for enrolled students */}
                          {!isTeacher && (
                            <Checkbox
                              checked={activity.completed}
                              disabled
                              checkedIcon={
                                <CheckCircle color="success" aria-label={`${activity.name} completed`} />
                              }
                              sx={{ mr: 1 }}
                              inputProps={{
                                'aria-label': activity.completed
                                  ? `${activity.name} is completed`
                                  : `${activity.name} is not completed`,
                              }}
                            />
                          )}

                          {/* Visibility toggle for teachers */}
                          {isTeacher && (
                            <IconButton
                              size="small"
                              sx={{ mr: 1 }}
                              aria-label={
                                activity.visible
                                  ? `${activity.name} is visible to students`
                                  : `${activity.name} is hidden from students`
                              }
                            >
                              {activity.visible ? (
                                <Visibility fontSize="small" color="action" />
                              ) : (
                                <VisibilityOff fontSize="small" color="warning" />
                              )}
                            </IconButton>
                          )}
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 3,
                    color: 'text.secondary',
                  }}
                  data-testid={`section-${section.id}-empty`}
                >
                  <Typography variant="body2">
                    No activities in this section
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
