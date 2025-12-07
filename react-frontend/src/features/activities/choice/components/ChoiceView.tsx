/**
 * ChoiceView Component
 *
 * Main React component for the Choice activity view that orchestrates the complete
 * choice UI. This component serves as the primary entry point for displaying choice
 * activities, handling user interactions, and managing state.
 *
 * Key Responsibilities:
 * - Display choice description and availability status
 * - Conditionally render ChoiceOptions component for making selections
 * - Conditionally render ChoiceResults component for viewing responses
 * - Manage form submission and response deletion
 * - Integrate with React Query for data fetching and mutations
 * - Handle different visibility states based on user capabilities and time restrictions
 *
 * Backend Reference: public/mod/choice/view.php
 * - Line 30: choice_get_choice() for fetching choice data
 * - Lines 39, 104-110: Availability warnings and status messages
 * - Lines 123, 133: choice_get_response_data() and choice_get_my_response()
 * - Lines 135-142: Current selection display
 * - Lines 146-149: Preview mode handling
 * - Lines 153-154: Closed state handling
 * - Lines 157-197: ChoiceOptions conditional rendering
 * - Lines 160-191: Show results publication settings
 * - Lines 205-224: Guest and non-enrolled user handling
 * - Line 228: choice_can_view_results() check
 * - Line 229: prepare_choice_show_results() for results data
 * - Lines 232-240: Results heading and groups filter
 *
 * @module features/activities/choice/components/ChoiceView
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

// Material-UI Components
import {
  Typography,
  Card,
  CardContent,
  Alert,
  Paper,
  Button,
  Container,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  CircularProgress,
  Divider,
  AlertTitle,
} from '@mui/material';

// Internal Components
import ChoiceOptions from './ChoiceOptions';
import ChoiceResults, { 
  type ChoiceResultsDataExtended,
  type OptionResult,
  type User,
} from './ChoiceResults';

// Custom Hooks
import { useChoice } from '../hooks/useChoice';
import { useChoiceResponse } from '../hooks/useChoiceResponse';
import useChoiceResults from '../hooks/useChoiceResults';
import { useToast } from '../../../../hooks/useToast';
import { usePermissions } from '../../../../hooks/usePermissions';

// Types
import {
  ShowResultsMode,
  PublishMode,
  type ChoiceOptionForDisplay,
} from '../types/choice.types';
import type { Choice, ChoiceOption } from '../hooks/useChoice';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Props interface for the ChoiceView component
 *
 * @property choiceId - The unique identifier of the choice activity
 * @property courseModuleId - Optional course module ID for context
 */
export interface ChoiceViewProps {
  /** The unique identifier of the choice activity */
  choiceId?: number;
  /** Optional course module ID for context-aware operations */
  courseModuleId?: number;
}

/**
 * Availability status for the choice activity
 *
 * Mirrors the output of choice_get_availability_status() from lib.php
 */
interface ChoiceAvailabilityStatus {
  /** Whether the choice is currently available for responses */
  available: boolean;
  /** Array of warning messages to display to the user */
  warnings: string[];
  /** Whether the choice is in preview mode (before timeopen) */
  isPreview: boolean;
  /** Whether the choice is closed (after timeclose) */
  isClosed: boolean;
  /** Whether the user can update their existing response */
  canUpdate: boolean;
}

/**
 * Group information for filtering results
 */
interface GroupInfo {
  /** Group ID */
  id: number;
  /** Group name */
  name: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Moodle capability for making choices
 */
const CAPABILITY_CHOOSE = 'mod/choice:choose';

/**
 * Moodle capability for reading responses
 */
const CAPABILITY_READ_RESPONSES = 'mod/choice:readresponses';

/**
 * Moodle capability for deleting responses
 */
const CAPABILITY_DELETE_RESPONSES = 'mod/choice:deleteresponses';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate availability status based on choice data and current time
 *
 * This mirrors the logic from choice_get_availability_status() in lib.php (lines 950-1000)
 *
 * @param choice - The choice data object
 * @param hasResponse - Whether the user has already responded
 * @returns Availability status object
 */
function calculateAvailability(
  choice: Choice | null | undefined,
  hasResponse: boolean
): ChoiceAvailabilityStatus {
  if (!choice) {
    return {
      available: false,
      warnings: ['Choice data not available'],
      isPreview: false,
      isClosed: false,
      canUpdate: false,
    };
  }

  const now = Date.now();
  const timeopenMs = choice.timeopen ? choice.timeopen * 1000 : 0;
  const timecloseMs = choice.timeclose ? choice.timeclose * 1000 : 0;
  const warnings: string[] = [];

  // Check preview mode (before timeopen and showpreview enabled)
  const isPreview = timeopenMs > 0 && timeopenMs > now && choice.showpreview;

  // Check if choice is closed
  const isClosed = timecloseMs > 0 && now > timecloseMs;

  // Check if choice is open (between timeopen and timeclose, or no restrictions)
  const isOpen =
    (timeopenMs === 0 || now >= timeopenMs) && (timecloseMs === 0 || now <= timecloseMs);

  // Build warning messages
  if (timeopenMs > 0 && now < timeopenMs) {
    const openDate = new Date(timeopenMs).toLocaleString();
    warnings.push(`This choice will open on ${openDate}`);
  }

  if (timecloseMs > 0 && !isClosed) {
    const closeDate = new Date(timecloseMs).toLocaleString();
    warnings.push(`This choice will close on ${closeDate}`);
  }

  if (isClosed) {
    warnings.push('This choice activity is closed');
  }

  // Determine if user can update their response
  const canUpdate = choice.allowupdate && isOpen;

  // Determine overall availability
  // User can respond if:
  // 1. Choice is open (not preview, not closed)
  // 2. User hasn't responded OR allowupdate is enabled
  const available =
    isOpen && (!hasResponse || (hasResponse && choice.allowupdate));

  return {
    available,
    warnings,
    isPreview,
    isClosed,
    canUpdate,
  };
}

/**
 * Format option names for display when showing current selection
 *
 * @param options - Array of choice options
 * @param selectedIds - Array of selected option IDs
 * @returns Formatted string of selected option names
 */
function formatSelectedOptions(
  options: ChoiceOption[] | undefined,
  selectedIds: number[] | undefined
): string {
  if (!options || !selectedIds || selectedIds.length === 0) {
    return '';
  }

  const selectedOptions = options.filter((opt) => selectedIds.includes(opt.id));
  return selectedOptions.map((opt) => opt.text).join(', ');
}

/**
 * Determine if results should be visible based on showresults setting
 *
 * This mirrors the logic from choice_can_view_results() in lib.php (lines 850-900)
 *
 * @param showResults - The show results mode setting
 * @param hasResponse - Whether the user has responded
 * @param isClosed - Whether the choice is closed
 * @param hasCapability - Whether user has read responses capability
 * @returns Boolean indicating if results should be shown
 */
function shouldShowResults(
  showResults: ShowResultsMode,
  hasResponse: boolean,
  isClosed: boolean,
  hasCapability: boolean
): boolean {
  // Users with readresponses capability can always see results
  if (hasCapability) {
    return true;
  }

  switch (showResults) {
    case ShowResultsMode.NOT:
      // Never show results to regular users
      return false;

    case ShowResultsMode.AFTER_ANSWER:
      // Show results only after user has answered
      return hasResponse;

    case ShowResultsMode.AFTER_CLOSE:
      // Show results only after choice is closed
      return isClosed;

    case ShowResultsMode.ALWAYS:
      // Always show results
      return true;

    default:
      return false;
  }
}

/**
 * Get human-readable message about when results will be available
 *
 * @param showResults - The show results mode setting
 * @param publishMode - The publish mode (anonymous or names)
 * @returns Message string for user
 */
function getResultsAvailabilityMessage(
  showResults: ShowResultsMode,
  publishMode: PublishMode
): string {
  const publishType =
    publishMode === PublishMode.ANONYMOUS
      ? 'anonymously'
      : 'with participant names';

  switch (showResults) {
    case ShowResultsMode.NOT:
      return 'Results are not published for this choice.';

    case ShowResultsMode.AFTER_ANSWER:
      return `Results will be shown ${publishType} after you make your choice.`;

    case ShowResultsMode.AFTER_CLOSE:
      return `Results will be shown ${publishType} after this activity closes.`;

    case ShowResultsMode.ALWAYS:
      return `Results are published ${publishType}.`;

    default:
      return '';
  }
}

/**
 * Transform results data from useChoiceResults hook into ChoiceResultsDataExtended format
 * 
 * This function converts the API response format from useChoiceResults into the 
 * ChoiceResultsDataExtended format expected by the ChoiceResults component.
 * It groups users by their selected options and calculates counts.
 * 
 * @param choiceData - The choice activity data
 * @param resultsData - The raw results data from useChoiceResults hook
 * @param canReadResponses - Whether user can read individual responses
 * @param canDeleteResponses - Whether user can delete responses
 * @param courseModuleId - The course module ID
 * @returns Transformed results data or null if data is insufficient
 */
function transformResultsData(
  choiceData: Choice | null | undefined,
  resultsData: { 
    responses: Array<{
      id: number;
      firstname: string;
      lastname: string;
      selectedOptions: Array<{ id: number; text: string; maxanswers?: number }>;
      answerid?: number;
    }>;
    totalCount: number;
  } | null | undefined,
  canReadResponses: boolean,
  canDeleteResponses: boolean,
  courseModuleId: number
): ChoiceResultsDataExtended | null {
  if (!choiceData || !resultsData) {
    return null;
  }

  // Build options map with users grouped by option
  const optionsMap: { [optionid: number]: OptionResult } = {};

  // Initialize options from choice data
  if (choiceData.options) {
    choiceData.options.forEach((option) => {
      optionsMap[option.id] = {
        text: option.text,
        user: [],
        maxanswer: option.maxanswers || 0,
        numberofuser: 0,
      };
    });
  }

  // Populate users for each option from results
  resultsData.responses.forEach((response) => {
    response.selectedOptions.forEach((selectedOption) => {
      const optionId = selectedOption.id;
      
      // Initialize option if not already present (edge case)
      if (!optionsMap[optionId]) {
        optionsMap[optionId] = {
          text: selectedOption.text,
          user: [],
          maxanswer: selectedOption.maxanswers || 0,
          numberofuser: 0,
        };
      }
      
      // Add user to option's user list
      const user: User = {
        id: response.id,
        firstname: response.firstname,
        lastname: response.lastname,
        imagealt: `${response.firstname} ${response.lastname}`,
        picture: '', // Placeholder - actual picture URL would come from API
        answerid: response.answerid || 0,
      };
      
      optionsMap[optionId].user.push(user);
      optionsMap[optionId].numberofuser = optionsMap[optionId].user.length;
    });
  });

  return {
    name: choiceData.name,
    publish: choiceData.publish === PublishMode.NAMES,
    options: optionsMap,
    showunanswered: true, // Default to show unanswered
    limitanswers: choiceData.limitanswers,
    showavailable: choiceData.showavailable,
    viewresponsecapability: canReadResponses,
    deleterepsonsecapability: canDeleteResponses,
    coursemoduleid: courseModuleId,
    sesskey: '', // Session key should come from API context
    numberofuser: resultsData.totalCount,
    courseid: choiceData.courseId,
  };
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ChoiceView Component
 *
 * Main orchestrator component for the Choice activity that handles:
 * - Data fetching and state management via React Query
 * - Conditional rendering based on availability and permissions
 * - User interactions for submitting and updating choices
 * - Result display for authorized users
 *
 * @param props - Component props
 * @returns JSX element
 *
 * @example
 * ```tsx
 * // Basic usage with route params
 * <ChoiceView />
 *
 * // With explicit props
 * <ChoiceView choiceId={123} courseModuleId={456} />
 * ```
 */
const ChoiceView: React.FC<ChoiceViewProps> = ({
  choiceId: propChoiceId,
  courseModuleId: propCourseModuleId,
}) => {
  // ============================================================================
  // URL Parameters and Navigation
  // ============================================================================

  const params = useParams<{ id?: string; cmid?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Extract IDs from props or URL params
  const choiceId = propChoiceId ?? (params.id ? parseInt(params.id, 10) : 0);
  const courseModuleId =
    propCourseModuleId ?? (params.cmid ? parseInt(params.cmid, 10) : 0);

  // Extract notification parameter from URL (for deep linking)
  const urlNotify = searchParams.get('notify');

  // ============================================================================
  // State Management
  // ============================================================================

  // Selected group for filtering results (teachers only)
  const [selectedGroup, setSelectedGroup] = useState<number>(0);

  // ============================================================================
  // Custom Hooks
  // ============================================================================

  // Toast notifications
  const { success, error: showError, info } = useToast();

  // Permissions
  const { hasCapability, isGuest } = usePermissions();

  // Fetch choice data
  const {
    data: choiceData,
    isLoading,
    isError,
    error: fetchError,
    refetch,
  } = useChoice(choiceId);

  // Response mutations
  const {
    mutateAsync: submitResponse,
    isPending: isSubmitting,
  } = useChoiceResponse();

  // Fetch choice results (for displaying aggregated responses)
  const {
    data: resultsData,
    isLoading: isLoadingResults,
  } = useChoiceResults({
    choiceId,
    groupId: selectedGroup || undefined,
    includeinactive: choiceData?.includeinactive || false,
  });

  // ============================================================================
  // Derived State
  // ============================================================================

  // User permissions
  const canChoose = hasCapability(CAPABILITY_CHOOSE);
  const canReadResponses = hasCapability(CAPABILITY_READ_RESPONSES);
  const canDeleteResponses = hasCapability(CAPABILITY_DELETE_RESPONSES);

  // Check if user has already responded
  const hasResponse = useMemo(() => {
    return (
      choiceData?.userAnswer !== undefined &&
      choiceData.userAnswer !== null &&
      Array.isArray(choiceData.userAnswer.selectedOptionIds) &&
      choiceData.userAnswer.selectedOptionIds.length > 0
    );
  }, [choiceData?.userAnswer]);

  // Calculate availability status
  const availability = useMemo(
    () => calculateAvailability(choiceData, hasResponse),
    [choiceData, hasResponse]
  );

  // Determine if user can make/update a choice
  const canMakeChoice = useMemo(() => {
    if (!canChoose || isGuest) {
      return false;
    }

    // Check availability
    if (!availability.available) {
      return false;
    }

    // If has response, check if updates are allowed
    if (hasResponse && !choiceData?.allowupdate) {
      return false;
    }

    return true;
  }, [canChoose, isGuest, availability.available, hasResponse, choiceData?.allowupdate]);

  // Determine if results should be shown
  const showResults = useMemo(() => {
    if (!choiceData) return false;

    return shouldShowResults(
      choiceData.showresults,
      hasResponse,
      availability.isClosed,
      canReadResponses
    );
  }, [choiceData, hasResponse, availability.isClosed, canReadResponses]);

  // Get results availability message
  const resultsMessage = useMemo(() => {
    if (!choiceData) return '';

    return getResultsAvailabilityMessage(
      choiceData.showresults,
      choiceData.publish
    );
  }, [choiceData]);

  // Format current selection for display
  const currentSelectionText = useMemo(() => {
    if (!hasResponse || !choiceData?.userAnswer?.selectedOptionIds) {
      return '';
    }

    return formatSelectedOptions(
      choiceData.options,
      choiceData.userAnswer.selectedOptionIds
    );
  }, [hasResponse, choiceData]);

  // Groups for filtering (if group mode is enabled)
  const groups: GroupInfo[] = useMemo(() => {
    // Groups would come from the API response in a real implementation
    // For now, we'll handle this based on whether groupMode is set
    return [];
  }, []);

  // Transform options to ChoiceOptionForDisplay format for ChoiceOptions component
  const transformedOptions = useMemo((): ChoiceOptionForDisplay[] => {
    if (!choiceData?.options) return [];

    const userSelectedIds = choiceData.userAnswer?.selectedOptionIds ?? [];

    return choiceData.options.map((option: ChoiceOption): ChoiceOptionForDisplay => {
      const isSelected = userSelectedIds.includes(option.id);
      const responseCount = option.countanswers ?? 0;
      const atLimit = choiceData.limitanswers && option.maxanswers > 0 && responseCount >= option.maxanswers;

      return {
        id: option.id,
        choiceid: choiceId,
        text: option.text,
        maxanswers: option.maxanswers,
        countanswers: responseCount,
        timemodified: Date.now(), // Not available from API, use current time as placeholder
        disabled: atLimit && !isSelected,
        checked: isSelected,
      };
    });
  }, [choiceData, choiceId]);

  // Transform results data for ChoiceResults component
  const transformedResults = useMemo(() => {
    return transformResultsData(
      choiceData,
      resultsData,
      canReadResponses,
      canDeleteResponses,
      courseModuleId
    );
  }, [choiceData, resultsData, canReadResponses, canDeleteResponses, courseModuleId]);

  // ============================================================================
  // Effect Handlers
  // ============================================================================

  // Handle URL notification parameter
  useEffect(() => {
    if (urlNotify === 'choicesaved') {
      success('Your choice has been saved');
    } else if (urlNotify === 'choicedeleted') {
      info('Your choice has been deleted');
    } else if (urlNotify === 'choiceupdated') {
      success('Your choice has been updated');
    }
  }, [urlNotify, success, info]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle choice submission
   *
   * Wraps choice_user_submit_response() from lib.php (line 86 of view.php)
   */
  const handleSubmit = useCallback(
    async (answer: number | number[]) => {
      // Normalize answer to array for consistent processing
      const selectedOptionIds = Array.isArray(answer) ? answer : [answer];
      
      try {
        await submitResponse({
          choiceId,
          answer: selectedOptionIds,
          action: 'submit',
          courseId: choiceData?.courseId ?? 0,
        });

        success(
          hasResponse
            ? 'Your choice has been updated'
            : 'Your choice has been saved'
        );

        // Refetch to get updated data
        await refetch();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to submit your choice';
        showError(errorMessage);
      }
    },
    [choiceId, choiceData?.courseId, submitResponse, hasResponse, success, showError, refetch]
  );

  /**
   * Handle response deletion
   *
   * Wraps choice_delete_responses() from lib.php (line 48 of view.php)
   */
  const handleDeleteResponse = useCallback(async () => {
    try {
      await submitResponse({
        choiceId,
        answer: [], // Empty array signals deletion
        action: 'delete',
        courseId: choiceData?.courseId ?? 0,
      });

      info('Your choice has been deleted');

      // Refetch to get updated data
      await refetch();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to delete your choice';
      showError(errorMessage);
    }
  }, [choiceId, choiceData?.courseId, submitResponse, info, showError, refetch]);

  /**
   * Handle group selection change for results filtering
   */
  const handleGroupChange = useCallback(
    (event: { target: { value: unknown } }) => {
      setSelectedGroup(event.target.value as number);
    },
    []
  );

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight={200}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  /**
   * Render error state
   */
  if (isError || !choiceData) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          <AlertTitle>Error Loading Choice</AlertTitle>
          {fetchError instanceof Error
            ? fetchError.message
            : 'Unable to load the choice activity. Please try again later.'}
        </Alert>
        <Box mt={2}>
          <Button variant="outlined" onClick={() => refetch()}>
            Try Again
          </Button>
        </Box>
      </Container>
    );
  }

  /**
   * Render guest user message
   *
   * Reference: view.php lines 205-224
   */
  if (isGuest) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {choiceData.name}
        </Typography>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <div
              dangerouslySetInnerHTML={{ __html: choiceData.intro || '' }}
            />
          </CardContent>
        </Card>
        <Alert severity="info">
          <AlertTitle>Guest Access</AlertTitle>
          Guests are not allowed to make choices. Please log in to participate.
        </Alert>
        <Box mt={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/login')}
          >
            Log In
          </Button>
        </Box>
      </Container>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Page Title - Reference: view.php line 53 */}
      <Typography variant="h4" component="h1" gutterBottom>
        {choiceData.name}
      </Typography>

      {/* Choice Description Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* Intro/Description - formatted HTML */}
          {choiceData.intro && (
            <Typography
              component="div"
              dangerouslySetInnerHTML={{ __html: choiceData.intro }}
            />
          )}
        </CardContent>
      </Card>

      {/* Availability Warnings - Reference: view.php lines 39, 104-110 */}
      {availability.warnings.length > 0 && (
        <Box mb={3}>
          {availability.warnings.map((warningMsg, index) => (
            <Alert
              key={index}
              severity={availability.isClosed ? 'warning' : 'info'}
              sx={{ mb: 1 }}
            >
              {warningMsg}
            </Alert>
          ))}
        </Box>
      )}

      {/* Preview Mode Notice - Reference: view.php lines 146-149 */}
      {availability.isPreview && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Preview Mode</AlertTitle>
          This choice is currently in preview mode. You can view the options but
          cannot submit a response until the activity opens.
        </Alert>
      )}

      {/* Current Selection Display - Reference: view.php lines 135-142 */}
      {hasResponse && !canMakeChoice && currentSelectionText && (
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: 'info.lighter',
            borderLeft: 4,
            borderColor: 'info.main',
          }}
        >
          <Typography variant="subtitle1" fontWeight="medium">
            Your selection:
          </Typography>
          <Typography variant="body1">{currentSelectionText}</Typography>
        </Paper>
      )}

      {/* Results Publication Info - Reference: view.php lines 160-191 */}
      {!showResults && resultsMessage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {resultsMessage}
        </Alert>
      )}

      {/* Choice Options Form - Reference: view.php lines 157-197 */}
      {(canMakeChoice || availability.isPreview) && transformedOptions.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {hasResponse ? 'Update Your Choice' : 'Make Your Choice'}
            </Typography>

            <ChoiceOptions
              options={transformedOptions}
              allowMultiple={choiceData.allowmultiple}
              limitAnswers={choiceData.limitanswers}
              showAvailable={choiceData.showavailable}
              hascapability={canChoose}
              allowUpdate={choiceData.allowupdate}
              previewOnly={availability.isPreview || isSubmitting}
              initialSelection={choiceData.userAnswer?.selectedOptionIds ?? []}
              onSubmit={handleSubmit}
              onRemove={handleDeleteResponse}
              displayLayout={choiceData.display === 1 ? 'horizontal' : 'vertical'}
            />

            {/* Delete Response Button (if user has responded and can update) */}
            {hasResponse && choiceData.allowupdate && (
              <Box mt={2}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDeleteResponse}
                  disabled={isSubmitting}
                >
                  Remove My Choice
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Section - Reference: view.php lines 228-246 */}
      {showResults && (
        <>
          <Divider sx={{ my: 3 }} />

          {/* Results Heading - Reference: view.php line 232 */}
          <Typography variant="h5" gutterBottom>
            Responses
          </Typography>

          {/* Group Filter (if group mode enabled) - Reference: view.php lines 235-240 */}
          {groups.length > 0 && canReadResponses && (
            <FormControl size="small" sx={{ mb: 2, minWidth: 200 }}>
              <InputLabel id="group-filter-label">Filter by Group</InputLabel>
              <Select
                labelId="group-filter-label"
                value={selectedGroup}
                label="Filter by Group"
                onChange={handleGroupChange}
              >
                <MenuItem value={0}>All Groups</MenuItem>
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Results Display */}
          {transformedResults ? (
            <ChoiceResults
              results={transformedResults}
              displayLayout={choiceData?.display === 1 ? 'horizontal' : 'vertical'}
            />
          ) : isLoadingResults ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
              <Typography sx={{ ml: 2 }}>Loading results...</Typography>
            </Box>
          ) : (
            <Alert severity="info">
              No responses have been submitted yet.
            </Alert>
          )}
        </>
      )}

      {/* No Results Viewable Message - Reference: view.php line 246 */}
      {!showResults && !canMakeChoice && !availability.isPreview && (
        <Alert severity="info">
          {hasResponse
            ? 'Results are not currently available for viewing.'
            : 'You have already participated in this choice or the activity is closed.'}
        </Alert>
      )}
    </Container>
  );
};

// Default export as specified in exports schema
export default ChoiceView;
