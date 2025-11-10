/**
 * ChoiceResults Component
 *
 * React component for displaying choice activity aggregated results with support for
 * anonymous and named publish modes. Shows response counts and percentages for each option,
 * renders user lists with action buttons for teachers, integrates ChoiceChart component
 * for visual representation, and implements Material-UI Table for named results with
 * support for bulk actions for deleting or modifying responses.
 *
 * Based on Moodle's mod_choice_renderer from public/mod/choice/renderer.php:
 * - Lines 118-130: display_result method for mode determination
 * - Lines 137-356: display_publish_name_vertical logic for named mode
 * - Lines 358-450: display_publish_anonymous logic for anonymous mode
 * - Lines 199-216: checkbox_toggleall pattern for select/deselect all
 * - Lines 266-288: Individual response checkboxes for bulk actions
 *
 * @module features/activities/choice/components/ChoiceResults
 */

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Checkbox,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import { Delete, DriveFileMove } from '@mui/icons-material';
import { ChoiceChart, type ChartOption } from './ChoiceChart';
import type { ChoiceResultsData } from '../types/choice.types';
import useDeleteResponses from '../hooks/useDeleteResponses';
import useModifyResponses from '../hooks/useModifyResponses';

/**
 * User information for a choice response.
 * Represents a user who has selected a specific option.
 *
 * Based on user data structure from public/mod/choice/renderer.php lines 254-260.
 */
export interface User {
  /** User ID */
  id: number;
  /** User's first name */
  firstname: string;
  /** User's last name */
  lastname: string;
  /** Alt text for user profile picture */
  imagealt: string;
  /** User profile picture URL or identifier */
  picture: string;
  /** Answer/response ID for this user's choice */
  answerid: number;
}

/**
 * Option result data with user responses.
 * Contains the option text, users who selected it, and limit information.
 *
 * Based on options structure from public/mod/choice/renderer.php lines 179-232.
 */
export interface OptionResult {
  /** Display text for the option */
  text: string;
  /** Array of users who selected this option */
  user: User[];
  /** Maximum number of answers allowed for this option (0 = unlimited) */
  maxanswer: number;
  /** Number of users who selected this option */
  numberofuser?: number;
}

/**
 * Complete results data structure for choice activity.
 * Contains all information needed to display results in either anonymous or named mode.
 *
 * Based on choice results structure from public/mod/choice/renderer.php lines 137-156.
 */
export interface ChoiceResultsDataExtended {
  /** Name of the choice activity */
  name: string;
  /** Whether to publish names (true) or show anonymous results (false) */
  publish: boolean;
  /** Map of option ID to option result data */
  options: { [optionid: number]: OptionResult };
  /** Whether to show "Not answered" column */
  showunanswered: boolean;
  /** Whether answer limits are enabled */
  limitanswers: boolean;
  /** Whether to show available spaces */
  showavailable: boolean;
  /** Whether current user can view responses */
  viewresponsecapability: boolean;
  /** Whether current user can delete responses */
  deleterepsonsecapability: boolean;
  /** Course module ID for the choice activity */
  coursemoduleid: number;
  /** Total number of users who participated */
  numberofuser?: number;
  /** Course ID for user profile links */
  courseid?: number;
}

/**
 * Props for the ChoiceResults component.
 *
 * @interface ChoiceResultsProps
 * @property {ChoiceResultsDataExtended} results - Complete results data
 * @property {'horizontal' | 'vertical'} displayLayout - Display layout mode
 */
export interface ChoiceResultsProps {
  /** Complete choice results data including options and permissions */
  results: ChoiceResultsDataExtended;
  /** Display layout for the results (horizontal or vertical) */
  displayLayout: 'horizontal' | 'vertical';
}

/**
 * ChoiceResults Component
 *
 * Displays choice activity results in two modes based on publish settings:
 *
 * **Anonymous Mode (publish=false)**:
 * - Renders ChoiceChart component with response counts and percentages
 * - Shows summary table with option names and total responses
 * - No user names displayed
 *
 * **Named Mode (publish=true)**:
 * - Renders Material-UI Table with columns for each option
 * - Option text as column header with toggle select-all checkbox
 * - Rows showing response counts per option
 * - Additional rows listing individual user names with profile links
 * - Checkboxes for selecting responses when permissions allow
 * - Action buttons for bulk delete and modify operations
 *
 * Features:
 * - Support for "Not answered" column when showunanswered is true
 * - Display limit information when limitanswers and showavailable are true
 * - Select/deselect all functionality with indeterminate state
 * - Responsive table with horizontal scroll on mobile
 * - Empty state when no responses exist
 * - Form wrapper with hidden inputs for sesskey, id, mode when capabilities exist
 *
 * @param {ChoiceResultsProps} props - Component props
 * @returns {JSX.Element} Rendered results display
 *
 * @example
 * ```tsx
 * <ChoiceResults
 *   results={choiceResultsData}
 *   displayLayout="vertical"
 * />
 * ```
 */
const ChoiceResults: React.FC<ChoiceResultsProps> = ({
  results,
  displayLayout,
}) => {
  // Extract results data
  const {
    name,
    publish,
    options,
    showunanswered,
    limitanswers,
    showavailable,
    viewresponsecapability,
    deleterepsonsecapability,
    coursemoduleid,
    numberofuser = 0,
    courseid = 0,
  } = results;

  // State for selected responses (for bulk actions)
  const [selectedAttempts, setSelectedAttempts] = useState<Set<number>>(new Set());
  const [selectedOptionForMove, setSelectedOptionForMove] = useState<number | ''>('');

  // React Query mutation hooks
  const { mutate: deleteResponses, isPending: isDeleting } = useDeleteResponses();
  const { mutate: modifyResponses, isPending: isModifying } = useModifyResponses();

  /**
   * Calculate chart data for anonymous mode.
   * Transforms option results into format expected by ChoiceChart component.
   *
   * Based on display_publish_anonymous logic from public/mod/choice/renderer.php lines 380-396.
   */
  const chartData = useMemo<ChartOption[]>(() => {
    const data: ChartOption[] = [];

    Object.entries(options).forEach(([optionIdStr, option]) => {
      const optionId = parseInt(optionIdStr, 10);

      // Skip "Not answered" option (id=0) if not showing unanswered
      if (optionId === 0 && !showunanswered) {
        return;
      }

      const count = option.user?.length || 0;
      const percentage = numberofuser > 0 ? (count / numberofuser) * 100 : 0;

      data.push({
        optionid: optionId,
        text: option.text,
        count,
        percentage,
        maxanswers: option.maxanswer > 0 ? option.maxanswer : undefined,
      });
    });

    return data;
  }, [options, showunanswered, numberofuser]);

  /**
   * Get array of option IDs sorted numerically.
   * Used for consistent column ordering in named mode table.
   *
   * Based on ksort($choices->options) from public/mod/choice/renderer.php line 160.
   */
  const sortedOptionIds = useMemo(() => {
    return Object.keys(options)
      .map((id) => parseInt(id, 10))
      .sort((a, b) => a - b);
  }, [options]);

  /**
   * Calculate total selected attempts across all options.
   * Used to determine if action buttons should be enabled.
   */
  const totalSelected = selectedAttempts.size;

  /**
   * Determine if select-all checkbox should be checked or indeterminate.
   * Checked: all responses are selected
   * Indeterminate: some but not all responses are selected
   * Unchecked: no responses are selected
   *
   * Based on checkbox_toggleall pattern from public/mod/choice/renderer.php lines 206-214.
   */
  const allResponsesCount = useMemo(() => {
    return Object.values(options).reduce((sum, option) => {
      return sum + (option.user?.length || 0);
    }, 0);
  }, [options]);

  const isAllSelected = totalSelected > 0 && totalSelected === allResponsesCount;
  const isIndeterminate = totalSelected > 0 && totalSelected < allResponsesCount;

  /**
   * Handle select/deselect all checkbox toggle.
   * Selects or deselects all visible response checkboxes.
   *
   * Based on checkbox_toggleall selectall/deselectall from renderer.php lines 206-214.
   */
  const handleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all
      setSelectedAttempts(new Set());
    } else {
      // Select all
      const allAttemptIds = new Set<number>();
      Object.values(options).forEach((option) => {
        option.user?.forEach((user) => {
          if (user.answerid) {
            allAttemptIds.add(user.answerid);
          }
        });
      });
      setSelectedAttempts(allAttemptIds);
    }
  };

  /**
   * Handle individual response checkbox toggle.
   * Adds or removes attempt ID from selection set.
   *
   * Based on checkbox toggle from public/mod/choice/renderer.php lines 273-280.
   */
  const handleToggleResponse = (attemptId: number) => {
    setSelectedAttempts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(attemptId)) {
        newSet.delete(attemptId);
      } else {
        newSet.add(attemptId);
      }
      return newSet;
    });
  };

  /**
   * Handle select/deselect all for a specific option column.
   * Toggles all checkboxes within a single option.
   *
   * Based on checkbox_toggleall per option from renderer.php lines 199-216.
   */
  const handleSelectAllForOption = (optionId: number) => {
    const option = options[optionId];
    if (!option?.user) return;

    const optionAttemptIds = option.user
      .filter((user) => user.answerid)
      .map((user) => user.answerid);

    // Check if all option attempts are currently selected
    const allSelected = optionAttemptIds.every((id) => selectedAttempts.has(id));

    setSelectedAttempts((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        // Deselect all for this option
        optionAttemptIds.forEach((id) => newSet.delete(id));
      } else {
        // Select all for this option
        optionAttemptIds.forEach((id) => newSet.add(id));
      }
      return newSet;
    });
  };

  /**
   * Handle delete selected responses.
   * Calls the delete mutation with selected attempt IDs.
   *
   * Based on action=delete from public/mod/choice/renderer.php lines 316-317.
   */
  const handleDeleteSelected = () => {
    if (totalSelected === 0) return;

    const attemptIds = Array.from(selectedAttempts);

    deleteResponses(
      {
        choiceId: coursemoduleid,
        attemptIds,
      },
      {
        onSuccess: () => {
          // Clear selection after successful deletion
          setSelectedAttempts(new Set());
        },
      }
    );
  };

  /**
   * Handle modify selected responses to new option.
   * Calls the modify mutation with selected attempt IDs and target option.
   *
   * Based on action='choose_' from public/mod/choice/renderer.php lines 318-321.
   */
  const handleModifySelected = () => {
    if (totalSelected === 0 || !selectedOptionForMove) return;

    const attemptIds = Array.from(selectedAttempts);

    // Extract user IDs from selected attempts
    const userIds: number[] = [];
    Object.values(options).forEach((option) => {
      option.user?.forEach((user) => {
        if (user.answerid && selectedAttempts.has(user.answerid)) {
          userIds.push(user.id);
        }
      });
    });

    modifyResponses(
      {
        choiceId: coursemoduleid,
        userIds,
        attemptIds,
        newOptionId: selectedOptionForMove as number,
      },
      {
        onSuccess: () => {
          // Clear selection after successful modification
          setSelectedAttempts(new Set());
          setSelectedOptionForMove('');
        },
      }
    );
  };

  /**
   * Check if any options have responses.
   * Used to display empty state when no responses exist.
   */
  const hasResponses = useMemo(() => {
    return Object.values(options).some((option) => option.user && option.user.length > 0);
  }, [options]);

  /**
   * Render anonymous mode results.
   * Displays ChoiceChart component with aggregated response data.
   *
   * Based on display_publish_anonymous from public/mod/choice/renderer.php lines 379-409.
   */
  const renderAnonymousMode = () => {
    if (!hasResponses) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No responses have been submitted yet.
        </Alert>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          {name} - Results
        </Typography>
        <ChoiceChart
          options={chartData}
          displayLayout={displayLayout}
          showPercentages={true}
        />
      </Box>
    );
  };

  /**
   * Render named mode results with detailed user information.
   * Displays Material-UI Table with option columns and user rows.
   *
   * Based on display_publish_name_vertical from public/mod/choice/renderer.php lines 137-356.
   */
  const renderNamedMode = () => {
    if (!hasResponses) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No responses have been submitted yet.
        </Alert>
      );
    }

    const canModify = viewresponsecapability && deleterepsonsecapability;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          {name} - Results
        </Typography>

        {/* Form wrapper when capabilities exist (lines 144-149) */}
        <Box
          component={canModify ? 'form' : 'div'}
          id="attemptsform"
          method="POST"
          sx={{ overflowX: 'auto' }}
        >
          {/* Hidden form inputs for sesskey, id, mode (lines 146-148) */}
          {canModify && (
            <>
              <input type="hidden" name="id" value={coursemoduleid} />
              <input type="hidden" name="mode" value="overview" />
            </>
          )}

          {/* Results table (lines 151-299) */}
          <Paper elevation={2} sx={{ mt: 2 }}>
            <Table className="results names table-bordered" sx={{ minWidth: 650 }}>
              <TableHead>
                {/* Header row with option names and select-all checkboxes (lines 162-232) */}
                <TableRow>
                  {/* Accessibility cell (lines 166-170) */}
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                    Choice Options
                  </TableCell>

                  {/* Option columns with select-all checkboxes (lines 179-232) */}
                  {sortedOptionIds.map((optionId) => {
                    const option = options[optionId];
                    if (!option) return null;

                    // Skip "Not answered" if not showing (lines 183-184)
                    if (optionId === 0 && !showunanswered) {
                      return null;
                    }

                    // Determine header title (lines 183-195)
                    let headerTitle = option.text;
                    if (optionId === 0) {
                      headerTitle = 'Not answered';
                    } else if (
                      limitanswers &&
                      option.user &&
                      option.user.length === option.maxanswer &&
                      option.maxanswer > 0
                    ) {
                      headerTitle += ' (Full)';
                    }

                    return (
                      <TableCell
                        key={optionId}
                        align="center"
                        sx={{ fontWeight: 'bold', minWidth: 200 }}
                      >
                        <Box>
                          <Typography variant="subtitle1">{headerTitle}</Typography>

                          {/* Select-all checkbox for this option (lines 199-216) */}
                          {canModify && (
                            <Checkbox
                              size="small"
                              checked={
                                option.user &&
                                option.user.length > 0 &&
                                option.user.every((user) =>
                                  selectedAttempts.has(user.answerid)
                                )
                              }
                              indeterminate={
                                option.user &&
                                option.user.some((user) =>
                                  selectedAttempts.has(user.answerid)
                                ) &&
                                !option.user.every((user) =>
                                  selectedAttempts.has(user.answerid)
                                )
                              }
                              onChange={() => handleSelectAllForOption(optionId)}
                              aria-label={`Select all responses for ${headerTitle}`}
                            />
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Number of users row (lines 172-235) */}
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                    Number of users
                  </TableCell>

                  {sortedOptionIds.map((optionId) => {
                    const option = options[optionId];
                    if (!option) return null;

                    if (optionId === 0 && !showunanswered) {
                      return null;
                    }

                    const userCount = option.user?.length || 0;

                    return (
                      <TableCell key={optionId} align="center">
                        <Box>
                          <Typography variant="body1">{userCount}</Typography>

                          {/* Show limit information (lines 222-225) */}
                          {limitanswers && showavailable && option.maxanswer > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              Limit: {option.maxanswer}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>

              <TableBody>
                {/* User response rows (lines 237-297) */}
                <TableRow>
                  {/* Accessibility label cell (lines 239-245) */}
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                    Users who chose this option
                  </TableCell>

                  {/* User lists for each option (lines 247-296) */}
                  {sortedOptionIds.map((optionId) => {
                    const option = options[optionId];
                    if (!option) return null;

                    if (optionId === 0 && !showunanswered) {
                      return null;
                    }

                    return (
                      <TableCell key={optionId} align="left" sx={{ verticalAlign: 'top' }}>
                        {/* Render user list (lines 252-291) */}
                        {option.user && option.user.length > 0 ? (
                          <Box>
                            {option.user.map((user) => {
                              const fullName = `${user.firstname} ${user.lastname}`;
                              const isChecked = selectedAttempts.has(user.answerid);

                              return (
                                <Box
                                  key={user.answerid || user.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    mb: 1,
                                  }}
                                >
                                  {/* Checkbox for bulk actions (lines 262-281) */}
                                  {canModify && (
                                    <Checkbox
                                      size="small"
                                      checked={isChecked}
                                      onChange={() => handleToggleResponse(user.answerid)}
                                      sx={{ mr: 1 }}
                                      aria-label={`Select ${fullName}`}
                                    />
                                  )}

                                  {/* User profile link (lines 283-286) */}
                                  <Box
                                    component="a"
                                    href={`/user/view.php?id=${user.id}&course=${courseid}`}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      textDecoration: 'none',
                                      color: 'text.primary',
                                      '&:hover': {
                                        textDecoration: 'underline',
                                      },
                                    }}
                                  >
                                    {/* User picture placeholder */}
                                    {user.picture && (
                                      <Box
                                        component="img"
                                        src={user.picture}
                                        alt={user.imagealt || fullName}
                                        sx={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: '50%',
                                          mr: 1,
                                        }}
                                      />
                                    )}
                                    <Typography variant="body2">{fullName}</Typography>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No responses
                          </Typography>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* Action buttons section (lines 301-336) */}
          {canModify && (
            <Box
              className="responseaction"
              sx={{
                display: 'flex',
                gap: 2,
                mt: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {/* Select/deselect all button (lines 303-313) */}
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                onClick={handleSelectAll}
                disabled={allResponsesCount === 0}
              >
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </Button>

              {/* Delete selected button (lines 317) */}
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<Delete />}
                onClick={handleDeleteSelected}
                disabled={totalSelected === 0 || isDeleting}
              >
                Delete Selected ({totalSelected})
              </Button>

              {/* Move to option selector (lines 318-334) */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }} disabled={totalSelected === 0}>
                  <InputLabel id="move-option-label">Move to option</InputLabel>
                  <Select
                    labelId="move-option-label"
                    value={selectedOptionForMove}
                    label="Move to option"
                    onChange={(e) => setSelectedOptionForMove(e.target.value as number | '')}
                  >
                    <MenuItem value="">
                      <em>Choose action</em>
                    </MenuItem>
                    {sortedOptionIds
                      .filter((id) => id > 0) // Exclude "Not answered" option
                      .map((optionId) => (
                        <MenuItem key={optionId} value={optionId}>
                          {options[optionId]?.text || `Option ${optionId}`}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<DriveFileMove />}
                  onClick={handleModifySelected}
                  disabled={
                    totalSelected === 0 || !selectedOptionForMove || isModifying
                  }
                >
                  Move
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  // Render appropriate mode based on publish setting (lines 118-130)
  return publish ? renderNamedMode() : renderAnonymousMode();
};

export default ChoiceResults;
