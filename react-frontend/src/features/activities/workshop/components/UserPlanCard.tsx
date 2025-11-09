import type React from 'react';
import {
  Card,
  CardHeader,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Badge,
  Typography,
  Box,
  useTheme,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Help as HelpIcon,
  Star as StarIcon,
} from '@mui/icons-material';

/**
 * Represents a single task within a workshop phase
 */
interface WorkshopTask {
  /** Task identifier */
  id: string;
  /** Task title/name */
  title: string;
  /** Additional details or description */
  details?: string;
  /** Completion status: true (completed), false (pending), 'info' (informational only) */
  completed: boolean | 'info';
  /** Optional action link for the task */
  link?: string;
}

/**
 * Represents a workshop phase with its tasks
 */
interface WorkshopPhase {
  /** Phase identifier */
  id: string;
  /** Phase title/name */
  title: string;
  /** Whether this phase is currently active */
  active: boolean;
  /** Tasks within this phase */
  tasks: WorkshopTask[];
}

/**
 * Workshop user plan containing all phases
 */
interface WorkshopUserPlan {
  /** Array of workshop phases */
  phases: WorkshopPhase[];
}

/**
 * Props for the UserPlanCard component
 */
interface UserPlanCardProps {
  /** The workshop user plan data containing all phases and tasks */
  userPlan: WorkshopUserPlan;
  /** The current active workshop phase (optional, for highlighting) */
  currentPhase?: WorkshopPhase;
}

/**
 * UserPlanCard Component
 * 
 * Displays the workshop user plan with phase-specific tasks and completion status.
 * Shows all five workshop phases (Setup, Submission, Assessment, Evaluation, Closed)
 * with expandable accordion sections for each phase.
 * 
 * Features:
 * - Accordion-style phase sections with task checklists
 * - Active phase highlighting with distinct background color
 * - Task completion status indicators (completed, pending, info-only)
 * - Action links for tasks that require user interaction
 * - Badge showing completed task count for each phase
 * - Automatically expands the currently active phase
 * 
 * @param {UserPlanCardProps} props - Component props
 * @returns {JSX.Element} Rendered UserPlanCard component
 */
function UserPlanCard({ userPlan, currentPhase }: UserPlanCardProps): React.ReactElement {
  const theme = useTheme();

  /**
   * Calculates the number of completed tasks in a phase
   * @param tasks - Array of tasks to evaluate
   * @returns Count of completed tasks
   */
  const getCompletedTasksCount = (tasks: WorkshopTask[]): number => {
    return tasks.filter((task) => task.completed === true).length;
  };

  /**
   * Determines if a phase is currently active
   * @param phase - Phase to check
   * @returns True if the phase is active
   */
  const isActivePhase = (phase: WorkshopPhase): boolean => {
    return phase.active || (currentPhase?.id === phase.id);
  };

  /**
   * Renders the appropriate status icon for a phase
   * @param phase - Phase to render icon for
   * @returns Status icon component
   */
  const renderPhaseStatusIcon = (phase: WorkshopPhase) => {
    const completedCount = getCompletedTasksCount(phase.tasks);
    const totalCount = phase.tasks.length;

    if (isActivePhase(phase)) {
      return <StarIcon color="primary" />;
    } else if (completedCount === totalCount && totalCount > 0) {
      return <CheckCircleIcon sx={{ color: theme.palette.success.main }} />;
    } 
      return <RadioButtonUncheckedIcon color="disabled" />;
    
  };

  /**
   * Renders the status icon for an individual task
   * @param task - Task to render icon for
   * @returns Task status icon component
   */
  const renderTaskStatusIcon = (task: WorkshopTask) => {
    if (task.completed === true) {
      return <CheckCircleIcon sx={{ color: theme.palette.success.main }} />;
    } else if (task.completed === 'info') {
      return <HelpIcon sx={{ color: theme.palette.info.main }} />;
    } 
      return <RadioButtonUncheckedIcon color="disabled" />;
    
  };

  /**
   * Handles task action button click
   * @param link - URL to navigate to
   */
  const handleTaskAction = (link: string) => {
    // Navigate to the task action link
    window.location.href = link;
  };

  return (
    <Card elevation={2} sx={{ width: '100%' }}>
      <CardHeader
        title={
          <Typography variant="h6" component="h2">
            Workshop Plan
          </Typography>
        }
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 2,
        }}
      />
      <Box sx={{ p: 2 }}>
        {userPlan.phases.map((phase) => {
          const completedCount = getCompletedTasksCount(phase.tasks);
          const totalCount = phase.tasks.length;
          const isActive = isActivePhase(phase);

          return (
            <Accordion
              key={phase.id}
              defaultExpanded={isActive}
              sx={{
                backgroundColor: isActive
                  ? theme.palette.action.selected
                  : 'transparent',
                '&:before': {
                  display: 'none',
                },
                mb: 1,
                borderRadius: 1,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  '& .MuiAccordionSummary-content': {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {renderPhaseStatusIcon(phase)}
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: isActive ? 600 : 400,
                    flexGrow: 1,
                  }}
                >
                  {phase.title}
                </Typography>
                <Badge
                  badgeContent={`${completedCount}/${totalCount}`}
                  color={completedCount === totalCount && totalCount > 0 ? 'success' : 'default'}
                  sx={{
                    '& .MuiBadge-badge': {
                      position: 'relative',
                      transform: 'none',
                      fontSize: '0.75rem',
                      height: 'auto',
                      minWidth: 'auto',
                      padding: '4px 8px',
                      borderRadius: 2,
                    },
                  }}
                />
              </AccordionSummary>
              <AccordionDetails>
                <List disablePadding>
                  {phase.tasks.map((task, index) => (
                    <ListItem
                      key={task.id}
                      divider={index < phase.tasks.length - 1}
                      sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {renderTaskStatusIcon(task)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" component="span">
                            {task.title}
                          </Typography>
                        }
                        secondary={
                          task.details && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              component="span"
                              sx={{ display: 'block', mt: 0.5 }}
                            >
                              {task.details}
                            </Typography>
                          )
                        }
                      />
                      {task.link && (
                        <ListItemSecondaryAction>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleTaskAction(task.link)}
                            disabled={task.completed === 'info'}
                            sx={{ minWidth: 80 }}
                          >
                            {task.completed === true ? 'View' : 'Start'}
                          </Button>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  ))}
                  {phase.tasks.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            fontStyle="italic"
                          >
                            No tasks available for this phase
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Card>
  );
}

export default UserPlanCard;
