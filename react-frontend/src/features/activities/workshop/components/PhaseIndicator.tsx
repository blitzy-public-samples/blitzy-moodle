/**
 * PhaseIndicator Component
 * 
 * Displays the current phase of a workshop activity with visual indicators
 * for the five phases: Setup, Submission, Assessment, Evaluation, and Closed.
 * 
 * This component uses Material-UI Stepper to show workshop phase progression,
 * mapping PHP phase constants (PHASE_SETUP=10, PHASE_SUBMISSION=20, 
 * PHASE_ASSESSMENT=30, PHASE_EVALUATION=40, PHASE_CLOSED=50) to React state.
 * 
 * Features:
 * - Color-coded phase progression with MUI theme integration
 * - Phase-specific icons for visual clarity
 * - Responsive design adapting to screen sizes
 * - Active phase highlighting
 * - Clear phase titles and descriptions
 * 
 * @packageDocumentation
 */

import { useMemo } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled,
  Typography,
} from '@mui/material';
import type { StepIconProps } from '@mui/material/StepIcon';
import {
  Settings as SetupIcon,
  CloudUpload as SubmissionIcon,
  RateReview as AssessmentIcon,
  Assessment as EvaluationIcon,
  CheckCircle as ClosedIcon,
} from '@mui/icons-material';
import { WorkshopPhase } from '../types/workshop.types';

/**
 * Props interface for PhaseIndicator component
 */
interface PhaseIndicatorProps {
  /**
   * Current active phase of the workshop
   * Must be one of the WorkshopPhase enum values
   */
  currentPhase: WorkshopPhase;
  
  /**
   * Optional flag to show phase descriptions
   * @default false
   */
  showDescriptions?: boolean;
  
  /**
   * Optional orientation for the stepper
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Interface defining a workshop phase configuration
 */
interface PhaseConfig {
  value: WorkshopPhase;
  label: string;
  description: string;
  icon: React.ReactElement;
  stepIconComponent: React.ComponentType<StepIconProps>;
}

/**
 * Custom styled connector for the stepper
 * Provides visual connection between phases with theme-aware colors
 */
const PhaseConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: `linear-gradient(95deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: `linear-gradient(95deg, ${theme.palette.success.main} 0%, ${theme.palette.success.light} 100%)`,
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[300],
    borderRadius: 1,
  },
}));

/**
 * Custom styled step icon container
 * Provides circular background for phase icons with theme-aware colors
 */
const PhaseIconRoot = styled('div')<{
  ownerState: { completed?: boolean; active?: boolean };
}>(({ theme, ownerState }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300],
  zIndex: 1,
  color: '#fff',
  width: 50,
  height: 50,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  ...(ownerState.active && {
    backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    boxShadow: '0 4px 10px 0 rgba(0,0,0,.25)',
  }),
  ...(ownerState.completed && {
    backgroundImage: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
  }),
}));

/**
 * Custom step icon component
 * Renders the appropriate icon for each phase with proper styling
 */
function PhaseStepIcon(props: {
  active?: boolean;
  completed?: boolean;
  icon: React.ReactNode;
}) {
  const { active = false, completed = false, icon } = props;

  return (
    <PhaseIconRoot ownerState={{ completed, active }}>
      {icon}
    </PhaseIconRoot>
  );
}

/**
 * Factory function to create a step icon component with a specific icon
 * Prevents nested component creation during render by returning a stable component reference
 */
const createStepIconComponent = (icon: React.ReactNode) => {
  // This creates a stable component that can be reused
  // We accept StepIconProps but use the icon from the closure instead of props.icon
  function StepIconComponent(props: StepIconProps) {
  return <PhaseStepIcon 
      active={props.active} 
      completed={props.completed} 
      icon={icon} 
    />
}
  // Set display name for debugging
  StepIconComponent.displayName = 'PhaseStepIconComponent';
  return StepIconComponent;
};

/**
 * PhaseIndicator Component
 * 
 * Visual display of workshop phase progression using Material-UI Stepper.
 * Maps workshop phase constants to user-friendly labels and icons.
 * 
 * @example
 * ```tsx
 * <PhaseIndicator 
 *   currentPhase={WorkshopPhase.SUBMISSION}
 *   showDescriptions={true}
 *   orientation="horizontal"
 * />
 * ```
 */
function PhaseIndicator({
  currentPhase,
  showDescriptions = false,
  orientation = 'horizontal',
}: PhaseIndicatorProps): JSX.Element {
  /**
   * Phase configuration array defining all workshop phases
   * Memoized to prevent recalculation on every render
   */
  const phases: PhaseConfig[] = useMemo(() => {
    const setupIcon = <SetupIcon />;
    const submissionIcon = <SubmissionIcon />;
    const assessmentIcon = <AssessmentIcon />;
    const evaluationIcon = <EvaluationIcon />;
    const closedIcon = <ClosedIcon />;

    return [
      {
        value: WorkshopPhase.SETUP,
        label: 'Setup',
        description: 'Configure workshop settings and grading criteria',
        icon: setupIcon,
        stepIconComponent: createStepIconComponent(setupIcon),
      },
      {
        value: WorkshopPhase.SUBMISSION,
        label: 'Submission',
        description: 'Students submit their work for peer review',
        icon: submissionIcon,
        stepIconComponent: createStepIconComponent(submissionIcon),
      },
      {
        value: WorkshopPhase.ASSESSMENT,
        label: 'Assessment',
        description: 'Peer review and evaluation of submissions',
        icon: assessmentIcon,
        stepIconComponent: createStepIconComponent(assessmentIcon),
      },
      {
        value: WorkshopPhase.EVALUATION,
        label: 'Evaluation',
        description: 'Calculate and aggregate final grades',
        icon: evaluationIcon,
        stepIconComponent: createStepIconComponent(evaluationIcon),
      },
      {
        value: WorkshopPhase.CLOSED,
        label: 'Closed',
        description: 'Workshop completed, all grades finalized',
        icon: closedIcon,
        stepIconComponent: createStepIconComponent(closedIcon),
      },
    ];
  }, []);

  /**
   * Calculate the active step index based on current phase
   * Memoized to recalculate only when currentPhase changes
   */
  const activeStep = useMemo(() => {
    const index = phases.findIndex((phase) => phase.value === currentPhase);
    // Return index if found, otherwise return 0 to show Setup phase as default
    return index !== -1 ? index : 0;
  }, [currentPhase, phases]);

  /**
   * Get the current phase configuration for displaying phase-specific information
   * Defaults to first phase (Setup) if activeStep is out of bounds
   */
  const currentPhaseConfig = useMemo(() => {
    const phase = phases[activeStep] ?? phases[0];
    // Ensure we always have a valid phase (fallback to Setup)
    return phase ?? {
      value: WorkshopPhase.SETUP,
      label: 'Setup',
      description: 'Configure workshop settings and grading criteria',
      icon: <SetupIcon />,
    };
  }, [phases, activeStep]);

  return (
    <Box
      sx={{
        width: '100%',
        padding: { xs: 2, sm: 3, md: 4 },
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
        borderRadius: 2,
        boxShadow: (theme) => theme.shadows[2],
      }}
    >
      {/* Current phase title and description */}
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography
          variant="h5"
          component="h2"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: 'primary.main',
          }}
        >
          Current Phase: {currentPhaseConfig.label}
        </Typography>
        {showDescriptions && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 600, mx: 'auto' }}
          >
            {currentPhaseConfig.description}
          </Typography>
        )}
      </Box>

      {/* Phase progression stepper */}
      <Stepper
        activeStep={activeStep}
        alternativeLabel={orientation === 'horizontal'}
        orientation={orientation}
        connector={<PhaseConnector />}
        sx={{
          '& .MuiStepLabel-label': {
            marginTop: 1,
            fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' },
          },
          '& .MuiStepLabel-label.Mui-active': {
            fontWeight: 600,
            color: 'primary.main',
          },
          '& .MuiStepLabel-label.Mui-completed': {
            fontWeight: 500,
            color: 'success.main',
          },
        }}
      >
        {phases.map((phase, index) => (
          <Step key={phase.value} completed={index < activeStep}>
            <StepLabel
              StepIconComponent={phase.stepIconComponent}
            >
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: index === activeStep ? 600 : 400,
                    display: { xs: 'none', sm: 'block' },
                  }}
                >
                  {phase.label}
                </Typography>
                {/* Show abbreviated labels on mobile */}
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: index === activeStep ? 600 : 400,
                    display: { xs: 'block', sm: 'none' },
                  }}
                >
                  {phase.label.substring(0, 4)}
                </Typography>
              </Box>
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Phase progress indicator */}
      <Box
        sx={{
          mt: 3,
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Phase {activeStep + 1} of {phases.length}
        </Typography>
        {activeStep < phases.length - 1 && phases[activeStep + 1] && (
          <Typography variant="body2" color="text.secondary">
            • Next: {phases[activeStep + 1]?.label}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default PhaseIndicator;
