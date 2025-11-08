import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  SelectChangeEvent,
  Box,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

/**
 * TypeScript interface for a group entity
 */
interface Group {
  id: number;
  name: string;
  courseid: number;
}

/**
 * API response structure for groups endpoint
 */
interface GroupsApiResponse {
  success: boolean;
  data: Group[];
}

/**
 * Props for the GroupFilter component
 */
export interface GroupFilterProps {
  /**
   * The course ID to fetch groups from
   */
  courseId: number;
  
  /**
   * The currently selected group ID (0 for 'All groups')
   */
  selectedGroupId: number;
  
  /**
   * Callback function invoked when group selection changes
   * @param groupId - The newly selected group ID (0 for all groups)
   */
  onGroupChange: (groupId: number) => void;
}

/**
 * GroupFilter Component
 * 
 * A dropdown selector component for filtering choice results by group membership.
 * Uses Material-UI Select with dynamic group loading based on course context.
 * 
 * Features:
 * - Fetches groups dynamically from the course using React Query
 * - Supports 'All groups' option for showing all responses
 * - Updates results when group selection changes
 * - Shows loading skeleton during data fetch
 * - Displays error messages if group fetch fails
 * 
 * Reference: public/mod/choice/report.php lines 79-84 (groups_print_activity_menu)
 * 
 * @param props - Component props
 * @returns React component rendering a group filter dropdown
 */
const GroupFilter: React.FC<GroupFilterProps> = ({
  courseId,
  selectedGroupId,
  onGroupChange,
}) => {
  /**
   * Fetch groups for the specified course using React Query
   * Endpoint: GET /api/v1/courses/{courseid}/groups
   */
  const {
    data: groupsResponse,
    isLoading,
    isError,
    error,
  } = useQuery<GroupsApiResponse>({
    queryKey: ['course-groups', courseId],
    queryFn: async () => {
      const response = await axios.get<GroupsApiResponse>(
        `/api/v1/courses/${courseId}/groups`
      );
      return response.data;
    },
    // Keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Retry failed requests up to 2 times
    retry: 2,
    // Use immediate retries (no delay) for faster feedback in tests
    retryDelay: 0,
    // Only fetch if courseId is valid
    enabled: courseId > 0,
  });

  /**
   * Handle group selection change
   * Converts string value to number and invokes callback
   */
  const handleChange = (event: SelectChangeEvent<number>) => {
    const newGroupId = Number(event.target.value);
    onGroupChange(newGroupId);
  };

  // Show loading skeleton while fetching groups
  if (isLoading) {
    return (
      <Box sx={{ minWidth: 200, maxWidth: 300 }}>
        <Skeleton 
          variant="rectangular" 
          height={56} 
          data-testid="group-filter-skeleton"
        />
      </Box>
    );
  }

  // Extract groups array from response (empty array if error)
  const groups = groupsResponse?.data || [];

  return (
    <Box>
      {/* Show error message if group fetch failed, but still render the filter */}
      {isError && (
        <Alert severity="error" sx={{ maxWidth: 400, mb: 2 }}>
          Failed to load groups: {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      )}
      
      <FormControl sx={{ minWidth: 200, maxWidth: 300 }} size="small">
        <InputLabel id="group-filter-label">Filter by group</InputLabel>
        <Select
          labelId="group-filter-label"
          id="group-filter-select"
          value={selectedGroupId}
          label="Filter by group"
          onChange={handleChange}
        >
          {/* 'All groups' option with value 0 */}
          <MenuItem value={0}>
            All groups
          </MenuItem>
          
          {/* Individual group options */}
          {groups.map((group) => (
            <MenuItem key={group.id} value={group.id}>
              {group.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default GroupFilter;
