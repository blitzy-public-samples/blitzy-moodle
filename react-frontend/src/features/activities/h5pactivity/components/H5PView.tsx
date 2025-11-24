/**
 * H5P Activity View Component
 *
 * Displays the H5P activity overview page with activity details, description,
 * settings display, and navigation to player and reports. This component transforms
 * the PHP server-side rendering in mod/h5pactivity/view.php into a modern React
 * component using Material-UI v5.
 *
 * Features:
 * - Activity information display (name, description, display options)
 * - Preview mode indicators for teachers/non-submitters
 * - Tracking enabled/disabled status warnings
 * - Navigation to H5P player and attempts report
 * - Capability-based conditional rendering
 * - Loading states with skeleton components
 * - Error boundaries with user-friendly messages
 * - Full accessibility with ARIA labels
 * - Material-UI theming support (light/dark modes)
 *
 * Maps to PHP functionality:
 * - view.php lines 74-90: Preview mode and tracking warnings
 * - view.php lines 92-102: View attempts action link
 * - view.php line 104: H5P player display
 * - manager.php: can_submit(), is_tracking_enabled(), can_view_all_attempts()
 *
 * @package    react-frontend
 * @module     features/activities/h5pactivity/components
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Typography, Button, Stack, Divider } from '@mui/material';
import { PlayArrow, Assessment, Edit } from '@mui/icons-material';

// Internal imports from dependency whitelist
import useH5PActivity from '../hooks/useH5PActivity';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { Alert } from '@/components/feedback/Alert';
import Card from '@/components/data-display/Card';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

/**
 * Props interface for the H5PView component
 * Uses URL params for activity ID to support direct navigation
 */
export interface H5PViewProps {
  /**
   * Optional H5P activity ID
   * If not provided, will be extracted from URL params
   */
  activityId?: number;

  /**
   * Optional course ID for context
   * Used for permission checks and navigation
   */
  courseId?: number;

  /**
   * Optional course module ID for context
   * Used for permission checks (moodle/course:manageactivities)
   */
  cmId?: number;
}

/**
 * H5P Activity View Component
 *
 * Renders the H5P activity overview with information, warnings, and navigation.
 * Fetches activity data using React Query hook and displays appropriate UI based
 * on user permissions and activity configuration.
 *
 * @param props - Component props including optional activity ID, course ID, and cm ID
 * @returns React component displaying H5P activity overview
 *
 * @example
 * Basic usage with URL params:
 * ```tsx
 * <Route path="/h5pactivity/:activityId" element={<H5PView />} />
 * ```
 *
 * @example
 * Direct usage with props:
 * ```tsx
 * <H5PView activityId={123} courseId={5} cmId={456} />
 * ```
 */
export function H5PView({ activityId: propActivityId, courseId, cmId }: H5PViewProps): JSX.Element {
  // Extract activity ID from URL params if not provided as prop
  const params = useParams<{ activityId: string }>();
  const activityId = propActivityId ?? (params.activityId ? parseInt(params.activityId, 10) : null);

  // Fetch H5P activity data with access permissions
  const {
    activity,
    access,
    isLoading,
    isError,
    error,
    isTrackingEnabled,
    canViewReports,
  } = useH5PActivity(activityId);

  // Get permission checking hook for capability checks
  const permissions = usePermissions();

  /**
   * Check if current user can manage activities (edit settings, enable tracking)
   * Maps to has_capability('moodle/course:manageactivities', $context) in PHP
   *
   * @returns true if user can manage course activities
   */
  const canManageActivities = React.useMemo(() => {
    if (!courseId || !cmId) {return false;}
    return permissions.hasCapability('moodle/course:manageactivities', {
      type: 'module',
      contextId: cmId,
    });
  }, [permissions, courseId, cmId]);

  /**
   * Render loading state with spinner
   * Displays while activity data is being fetched from API
   */
  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
        role="status"
        aria-live="polite"
        aria-label="Loading H5P activity"
      >
        <LoadingSpinner
          size="large"
          message="Loading H5P activity..."
          ariaLabel="Loading H5P activity data"
        />
      </Box>
    );
  }

  /**
   * Render error state with user-friendly message
   * Displays when API request fails or returns error
   */
  if (isError || !activity) {
    return (
      <Box p={3} role="alert" aria-live="assertive">
        <Alert
          severity="error"
          title="Error Loading Activity"
          message={
            error?.message ??
            'Unable to load H5P activity. Please try refreshing the page or contact your administrator if the problem persists.'
          }
          closeable={false}
        />
      </Box>
    );
  }

  /**
   * Check if user can submit (start attempts)
   * Maps to $manager->can_submit() in PHP (view.php line 75)
   */
  const canSubmit = access?.cansubmit ?? false;

  /**
   * Check if tracking is enabled for this activity
   * Maps to $manager->is_tracking_enabled() in PHP (view.php line 81)
   */
  const trackingEnabled = isTrackingEnabled();

  /**
   * Check if user can view reports/attempts
   * Maps to $manager->can_view_all_attempts() in PHP (view.php line 94)
   */
  const showReportsLink = canViewReports() && trackingEnabled;

  /**
   * Determine if preview mode message should be shown
   * Only shown to non-guest users without permission to submit
   * Maps to view.php lines 74-90
   */
  const showPreviewMode = !canSubmit;

  /**
   * Render tracking disabled warning with optional enable link
   * Maps to view.php lines 81-89
   *
   * @returns Alert component or null
   */
  const renderTrackingWarning = (): JSX.Element | null => {
    if (trackingEnabled || canSubmit) {
      return null;
    }

    // Build warning message with optional enable link
    let message: React.ReactNode = 'Tracking is disabled for this activity. Attempts will not be recorded.';

    if (canManageActivities && cmId) {
      // Provide link to edit activity settings to enable tracking
      // Maps to view.php lines 82-84
      message = (
        <Box>
          <Typography component="span">
            Tracking is disabled for this activity. Attempts will not be recorded.{' '}
          </Typography>
          <Button
            component={Link}
            to={`/course/modedit/${cmId}`}
            size="small"
            variant="text"
            startIcon={<Edit />}
            sx={{ textTransform: 'none', verticalAlign: 'baseline', p: 0, minWidth: 'auto' }}
            aria-label="Enable tracking in activity settings"
          >
            Enable tracking in settings
          </Button>
        </Box>
      );
    }

    return (
      <Alert
        severity="warning"
        message={message}
        closeable={false}
        sx={{ mb: 2 }}
      />
    );
  };

  /**
   * Main component render
   * Displays activity information, warnings, and navigation buttons
   */
  return (
    <Box>
      {/* Preview Mode Alert - Maps to view.php lines 75-79 */}
      {showPreviewMode && (
        <Alert
          severity="info"
          title="Preview Mode"
          message="You are viewing this activity in preview mode. You cannot submit attempts, but you can see how students will interact with the content."
          closeable={false}
          sx={{ mb: 2 }}
        />
      )}

      {/* Tracking Disabled Warning - Maps to view.php lines 81-89 */}
      {renderTrackingWarning()}

      {/* Activity Title - Semantic heading for accessibility */}
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 2 }}>
        {activity.name}
      </Typography>

      {/* Main Activity Card */}
      <Card
        elevation={2}
        sx={{ mb: 3 }}
        aria-label={`H5P Activity: ${activity.name}`}
      >
        {/* Activity Introduction/Description */}
        {activity.intro && (
          <Box mb={3}>
            <Typography
              variant="body1"
              component="div"
              dangerouslySetInnerHTML={{ __html: activity.intro }}
              sx={{
                '& img': { maxWidth: '100%', height: 'auto' },
                '& a': { color: 'primary.main', textDecoration: 'underline' },
              }}
              aria-label="Activity description"
            />
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Activity Settings Display */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Activity Settings
          </Typography>
          <Stack spacing={1}>
            {/* Grade Display */}
            {activity.grade > 0 && (
              <Typography variant="body2" color="text.secondary">
                <strong>Maximum grade:</strong> {activity.grade}
              </Typography>
            )}

            {/* Tracking Status */}
            <Typography variant="body2" color="text.secondary">
              <strong>Tracking:</strong> {trackingEnabled ? 'Enabled' : 'Disabled'}
            </Typography>

            {/* Review Mode Display */}
            {activity.reviewmode !== null && (
              <Typography variant="body2" color="text.secondary">
                <strong>Review mode:</strong>{' '}
                {activity.reviewmode === 0
                  ? 'Students cannot review their attempts'
                  : 'Students can review attempts after completion'}
              </Typography>
            )}
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {/* Launch H5P Player Button - Maps to view.php line 104 */}
          <Button
            component={Link}
            to={`/h5pactivity/${activityId}/player`}
            variant="contained"
            color="primary"
            size="large"
            startIcon={<PlayArrow />}
            aria-label="Launch H5P content player"
          >
            Launch Activity
          </Button>

          {/* View Attempts Report Button - Maps to view.php lines 94-102 */}
          {showReportsLink && (
            <Button
              component={Link}
              to={`/h5pactivity/${activityId}/report`}
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<Assessment />}
              aria-label="View attempts report"
            >
              View Attempts
            </Button>
          )}

          {/* Edit Activity Button - For users with manage capability */}
          {canManageActivities && cmId && (
            <Button
              component={Link}
              to={`/course/modedit/${cmId}`}
              variant="outlined"
              color="secondary"
              size="large"
              startIcon={<Edit />}
              aria-label="Edit activity settings"
            >
              Edit Settings
            </Button>
          )}
        </Stack>
      </Card>

      {/* Additional Information Box */}
      {activity.grade > 0 && trackingEnabled && (
        <Card elevation={1} sx={{ bgcolor: 'background.default' }}>
          <Alert
            severity="info"
            message={
              <Box>
                <Typography variant="body2" component="span">
                  Your attempts will be tracked and graded. The best score from your attempts will
                  be recorded in the gradebook.
                </Typography>
              </Box>
            }
            closeable={false}
            icon={false}
          />
        </Card>
      )}
    </Box>
  );
}

// Export as default for lazy loading support
export default H5PView;
