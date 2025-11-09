/**
 * GroupFilter Component
 *
 * Group filter dropdown component for filtering feedback analysis results by course group.
 * Mimics the functionality of groups_print_activity_menu from Moodle's grouplib.php.
 *
 * Features:
 * - MUI Select component for group selection
 * - Dynamic group loading with React Query integration
 * - Loading and error states
 * - "All participants" option
 * - TypeScript strict mode compliance
 * - Integration with Moodle groups system
 */

import type React from 'react';
import type { SelectChangeEvent } from '@mui/material';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  FormHelperText,
  Box,
} from '@mui/material';
import { Groups as GroupsIcon } from '@mui/icons-material';
import type { GroupFilterProps } from '../types/feedback.types';
import { GroupMode } from '../types/feedback.types';

/**
 * GroupFilter Component
 *
 * A dropdown component for filtering feedback analysis by course group.
 * Integrates with Moodle's group system and provides a user-friendly interface
 * for group selection with loading states and error handling.
 */
export function GroupFilter({
  groups,
  selectedGroupId,
  onChange,
  isLoading = false,
  error = null,
  groupMode,
  showAllParticipants = true,
  label,
  disabled = false,
  className,
  showIcon = true,
  size = 'medium',
  groupingName,
}: GroupFilterProps): React.JSX.Element {
  /**
   * Handle group selection change
   */
  const handleChange = (event: SelectChangeEvent<number>): void => {
    const { value } = event.target;
    const groupId = typeof value === 'string' ? parseInt(value, 10) : value;
    onChange(groupId);
  };

  /**
   * Determine the label text based on group mode
   */
  const getLabel = (): string => {
    if (label) {
      return label;
    }

    let baseLabel = '';
    if (groupMode === GroupMode.VISIBLEGROUPS) {
      baseLabel = 'Groups (visible)';
    } else if (groupMode === GroupMode.SEPARATEGROUPS) {
      baseLabel = 'Groups (separate)';
    } else {
      baseLabel = 'Groups';
    }

    if (groupingName) {
      baseLabel += ` (${groupingName})`;
    }

    return baseLabel;
  };

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <FormControl size={size} className={className} disabled>
        <InputLabel>{getLabel()}</InputLabel>
        <Select
          value={selectedGroupId}
          label={getLabel()}
          startAdornment={
            showIcon && (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                <GroupsIcon fontSize="small" color="action" />
              </Box>
            )
          }
          endAdornment={<CircularProgress size={20} sx={{ mr: 2 }} color="inherit" />}
        >
          <MenuItem value={selectedGroupId}>Loading...</MenuItem>
        </Select>
        <FormHelperText>Loading groups...</FormHelperText>
      </FormControl>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <FormControl size={size} className={className} error disabled>
        <InputLabel>{getLabel()}</InputLabel>
        <Select
          value={-1}
          label={getLabel()}
          startAdornment={
            showIcon && (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                <GroupsIcon fontSize="small" color="error" />
              </Box>
            )
          }
        >
          <MenuItem value={-1}>Error loading groups</MenuItem>
        </Select>
        <FormHelperText>{error}</FormHelperText>
      </FormControl>
    );
  }

  /**
   * Render empty state (no groups available)
   */
  if (groups.length === 0 && !showAllParticipants) {
    return (
      <FormControl size={size} className={className} disabled>
        <InputLabel>{getLabel()}</InputLabel>
        <Select
          value={0}
          label={getLabel()}
          startAdornment={
            showIcon && (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                <GroupsIcon fontSize="small" color="disabled" />
              </Box>
            )
          }
        >
          <MenuItem value={0}>No groups available</MenuItem>
        </Select>
        <FormHelperText>No groups have been created for this activity</FormHelperText>
      </FormControl>
    );
  }

  /**
   * Render single group state (only one option available)
   */
  if (groups.length === 1 && !showAllParticipants) {
    // Safe to access first element since we verified length === 1
    const singleGroup = groups[0];
    if (!singleGroup) {
      // Defensive check - should never happen due to length check
      return <Box />;
    }
    return (
      <FormControl size={size} className={className} disabled>
        <InputLabel>{getLabel()}</InputLabel>
        <Select
          value={singleGroup.id}
          label={getLabel()}
          startAdornment={
            showIcon && (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                <GroupsIcon fontSize="small" color="action" />
              </Box>
            )
          }
        >
          <MenuItem value={singleGroup.id}>{singleGroup.name}</MenuItem>
        </Select>
        <FormHelperText>
          {getLabel()}: {singleGroup.name}
        </FormHelperText>
      </FormControl>
    );
  }

  /**
   * Render normal selection state
   */
  return (
    <FormControl size={size} className={className}>
      <InputLabel id="group-filter-label">{getLabel()}</InputLabel>
      <Select
        labelId="group-filter-label"
        id="group-filter-select"
        value={selectedGroupId}
        label={getLabel()}
        onChange={handleChange}
        disabled={disabled}
        startAdornment={
          showIcon && (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              <GroupsIcon fontSize="small" color="action" />
            </Box>
          )
        }
        sx={{
          minWidth: 200,
        }}
      >
        {showAllParticipants && (
          <MenuItem value={0}>
            <Box sx={{ fontWeight: selectedGroupId === 0 ? 600 : 400 }}>All participants</Box>
          </MenuItem>
        )}
        {groups.map((group) => (
          <MenuItem key={group.id} value={group.id}>
            <Box sx={{ fontWeight: selectedGroupId === group.id ? 600 : 400 }}>{group.name}</Box>
          </MenuItem>
        ))}
      </Select>
      {groups.length === 0 && showAllParticipants && (
        <FormHelperText>No groups available. Showing all participants.</FormHelperText>
      )}
    </FormControl>
  );
}

export default GroupFilter;
